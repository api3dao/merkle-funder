import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { expect } from 'chai';
import * as hre from 'hardhat';
import { computeMerkleFunderDepositoryAddress } from '../src';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('MerkleFunder', function () {
  const deployMerkleFunder = async () => {
    const accounts = await hre.ethers.getSigners();
    const roles = {
      deployer: accounts[0],
      owner: accounts[1],
      recipient1: accounts[2],
      recipient2: accounts[3],
      recipient3: accounts[4],
      randomPerson: accounts[9],
    };

    const MerkleFunder = await hre.ethers.getContractFactory('MerkleFunder', roles.deployer);
    const merkleFunder = await MerkleFunder.deploy();

    const treeValues = await Promise.all(
      [roles.recipient1.address, roles.recipient2.address, roles.recipient3.address].map(async (recipientAddress) => {
        const recipientBalance = await hre.ethers.provider.getBalance(recipientAddress);
        const lowThreshold = recipientBalance.add(
          hre.ethers.utils.parseEther((Math.floor(Math.random() * 10) + 1).toString())
        );
        const highThreshold = lowThreshold.add(
          hre.ethers.utils.parseEther((Math.floor(Math.random() * 10) + 1).toString())
        );
        return [recipientAddress, lowThreshold, highThreshold];
      })
    );
    const tree = StandardMerkleTree.of(treeValues, ['address', 'uint256', 'uint256']);

    return {
      roles,
      merkleFunder,
      tree,
    };
  };

  const deployMerkleFunderAndMerkleFunderDepository = async () => {
    const { roles, merkleFunder, tree } = await deployMerkleFunder();
    const merkleFunderDepositoryAddress = await computeMerkleFunderDepositoryAddress(
      merkleFunder.address,
      roles.owner.address,
      tree.root
    );
    await merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root);
    const merkleFunderDepository = await hre.ethers.getContractAt(
      'MerkleFunderDepository',
      merkleFunderDepositoryAddress
    );
    await roles.randomPerson.sendTransaction({
      to: merkleFunderDepository.address,
      value: hre.ethers.utils.parseEther('100'),
    });
    return {
      roles,
      merkleFunder,
      tree,
      merkleFunderDepository,
    };
  };

  describe('deployMerkleFunderDepository', function () {
    context('Root is not zero', function () {
      context('MerkleFunderDepository has not been deployed before', function () {
        it('deploys MerkleFunderDepository', async function () {
          const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunder);
          const merkleFunderDepositoryAddress = await computeMerkleFunderDepositoryAddress(
            merkleFunder.address,
            roles.owner.address,
            tree.root
          );
          await expect(
            merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root)
          )
            .to.emit(merkleFunder, 'DeployedMerkleFunderDepository')
            .withArgs(merkleFunderDepositoryAddress, roles.owner.address, tree.root);
          expect(
            await merkleFunder.ownerToRootToMerkleFunderDepositoryAddress(roles.owner.address, tree.root)
          ).to.equal(merkleFunderDepositoryAddress);
          const merkleFunderDepository = await hre.ethers.getContractAt(
            'MerkleFunderDepository',
            merkleFunderDepositoryAddress
          );
          expect(await merkleFunderDepository.merkleFunder()).to.equal(merkleFunder.address);
          expect(await merkleFunderDepository.owner()).to.equal(roles.owner.address);
          expect(await merkleFunderDepository.root()).to.equal(tree.root);
        });
      });
      context('MerkleFunderDepository has been deployed before', function () {
        it('reverts', async function () {
          const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunder);
          await merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root);
          await expect(
            merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root)
          ).to.be.revertedWithoutReason;
        });
      });
    });
    context('Root is zero', function () {
      it('reverts', async function () {
        const { roles, merkleFunder } = await loadFixture(deployMerkleFunder);
        await expect(
          merkleFunder
            .connect(roles.owner)
            .deployMerkleFunderDepository(roles.owner.address, hre.ethers.constants.HashZero)
        ).to.be.revertedWith('Root zero');
      });
    });
  });

  describe('fund', function () {
    context('Recipient address is not zero', function () {
      context('Low threshold is not higher than high', function () {
        context('High threshold is not zero', function () {
          context('Proof is valid', function () {
            context('Balance is low enough', function () {
              context('Amount is not zero', function () {
                context('Respective MerkleFunderDepository is deployed', function () {
                  context('Transfer is successful', function () {
                    it('funds', async function () {
                      const { roles, merkleFunder, tree, merkleFunderDepository } = await loadFixture(
                        deployMerkleFunderAndMerkleFunderDepository
                      );
                      await Promise.all(
                        Array.from(tree.entries()).map(async ([treeValueIndex, treeValue]) => {
                          const recipientBalance = await hre.ethers.provider.getBalance(treeValue[0].toString());
                          const amountNeededToTopUp = hre.ethers.BigNumber.from(treeValue[2]).sub(recipientBalance);
                          // Note that we use `tree.getProof(treeValueIndex)` and not `tree.getProof(treeValue.treeIndex)`
                          expect(
                            await merkleFunder
                              .connect(roles.randomPerson)
                              .callStatic.fund(
                                roles.owner.address,
                                tree.root,
                                tree.getProof(treeValueIndex),
                                treeValue[0].toString(),
                                treeValue[1],
                                treeValue[2]
                              )
                          ).to.equal(amountNeededToTopUp);
                          await expect(
                            merkleFunder
                              .connect(roles.randomPerson)
                              .fund(
                                roles.owner.address,
                                tree.root,
                                tree.getProof(treeValueIndex),
                                treeValue[0].toString(),
                                treeValue[1],
                                treeValue[2]
                              )
                          )
                            .to.emit(merkleFunder, 'Funded')
                            .withArgs(merkleFunderDepository.address, treeValue[0].toString(), amountNeededToTopUp);
                          expect(await hre.ethers.provider.getBalance(treeValue[0].toString())).to.equal(
                            recipientBalance.add(amountNeededToTopUp)
                          );
                        })
                      );
                    });
                  });
                  context('Transfer is not successful', function () {
                    it('reverts', async function () {
                      const { roles, merkleFunder } = await loadFixture(deployMerkleFunder);
                      const tree = StandardMerkleTree.of(
                        [[merkleFunder.address, 1, 2]],
                        ['address', 'uint256', 'uint256']
                      );
                      const treeValueIndex = 0;
                      const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
                      await merkleFunder
                        .connect(roles.randomPerson)
                        .deployMerkleFunderDepository(roles.owner.address, tree.root);
                      const merkleFunderDepositoryAddress = await computeMerkleFunderDepositoryAddress(
                        merkleFunder.address,
                        roles.owner.address,
                        tree.root
                      );
                      await roles.randomPerson.sendTransaction({
                        to: merkleFunderDepositoryAddress,
                        value: hre.ethers.utils.parseEther('100'),
                      });
                      await expect(
                        merkleFunder
                          .connect(roles.randomPerson)
                          .fund(
                            roles.owner.address,
                            tree.root,
                            tree.getProof(treeValueIndex),
                            treeValue[0].toString(),
                            treeValue[1],
                            treeValue[2]
                          )
                      ).to.be.revertedWith('Transfer unsuccessful');
                    });
                  });
                });
                context('Respective MerkleFunderDepository is not deployed', function () {
                  it('reverts', async function () {
                    const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunder);
                    const treeValueIndex = 0;
                    const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
                    const merkleFunderDepositoryAddress = await computeMerkleFunderDepositoryAddress(
                      merkleFunder.address,
                      roles.owner.address,
                      tree.root
                    );
                    await roles.randomPerson.sendTransaction({
                      to: merkleFunderDepositoryAddress,
                      value: hre.ethers.utils.parseEther('100'),
                    });
                    await expect(
                      merkleFunder
                        .connect(roles.randomPerson)
                        .fund(
                          roles.owner.address,
                          tree.root,
                          tree.getProof(treeValueIndex),
                          treeValue[0].toString(),
                          treeValue[1],
                          treeValue[2]
                        )
                    ).to.be.revertedWith('No such MerkleFunderDepository');
                  });
                });
              });
              context('Amount is zero', function () {
                it('reverts', async function () {
                  const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunder);
                  const treeValueIndex = 0;
                  const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
                  await merkleFunder
                    .connect(roles.randomPerson)
                    .deployMerkleFunderDepository(roles.owner.address, tree.root);
                  await expect(
                    merkleFunder
                      .connect(roles.randomPerson)
                      .fund(
                        roles.owner.address,
                        tree.root,
                        tree.getProof(treeValueIndex),
                        treeValue[0].toString(),
                        treeValue[1],
                        treeValue[2]
                      )
                  ).to.be.revertedWith('Amount zero');
                });
              });
            });
            context('Balance is not low enough', function () {
              it('reverts', async function () {
                const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunderAndMerkleFunderDepository);
                const treeValueIndex = 0;
                const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
                const recipientBalance = await hre.ethers.provider.getBalance(treeValue[0].toString());
                const amountNeededToExceedLowThreshold = hre.ethers.BigNumber.from(treeValue[1])
                  .sub(recipientBalance)
                  .add(1);
                await roles.randomPerson.sendTransaction({
                  to: treeValue[0].toString(),
                  value: amountNeededToExceedLowThreshold,
                });
                await expect(
                  merkleFunder
                    .connect(roles.randomPerson)
                    .fund(
                      roles.owner.address,
                      tree.root,
                      tree.getProof(treeValueIndex),
                      treeValue[0].toString(),
                      treeValue[1],
                      treeValue[2]
                    )
                ).to.be.revertedWith('Balance not low enough');
              });
            });
          });
          context('Proof is not valid', function () {
            it('reverts', async function () {
              const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunderAndMerkleFunderDepository);
              const treeValueIndex = 0;
              const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
              await expect(
                merkleFunder
                  .connect(roles.randomPerson)
                  .fund(
                    roles.owner.address,
                    tree.root,
                    [hre.ethers.utils.hexlify(hre.ethers.utils.randomBytes(32))],
                    treeValue[0].toString(),
                    treeValue[1],
                    treeValue[2]
                  )
              ).to.be.revertedWith('Invalid proof');
            });
          });
        });
        context('High threshold is zero', function () {
          it('reverts', async function () {
            const { roles, merkleFunder } = await loadFixture(deployMerkleFunder);
            const tree = StandardMerkleTree.of([[roles.recipient1.address, 0, 0]], ['address', 'uint256', 'uint256']);
            const treeValueIndex = 0;
            const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
            await merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root);
            await expect(
              merkleFunder
                .connect(roles.randomPerson)
                .fund(
                  roles.owner.address,
                  tree.root,
                  tree.getProof(treeValueIndex),
                  treeValue[0].toString(),
                  treeValue[1],
                  treeValue[2]
                )
            ).to.be.revertedWith('High threshold zero');
          });
        });
      });
      context('Low threshold is higher than high', function () {
        it('reverts', async function () {
          const { roles, merkleFunder } = await loadFixture(deployMerkleFunder);
          const tree = StandardMerkleTree.of([[roles.recipient1.address, 2, 1]], ['address', 'uint256', 'uint256']);
          const treeValueIndex = 0;
          const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
          await merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root);
          await expect(
            merkleFunder
              .connect(roles.randomPerson)
              .fund(
                roles.owner.address,
                tree.root,
                tree.getProof(treeValueIndex),
                treeValue[0].toString(),
                treeValue[1],
                treeValue[2]
              )
          ).to.be.revertedWith('Low threshold higher than high');
        });
      });
    });
    context('Recipient address is zero', function () {
      it('reverts', async function () {
        const { roles, merkleFunder } = await loadFixture(deployMerkleFunder);
        const tree = StandardMerkleTree.of(
          [[hre.ethers.constants.AddressZero, 1, 2]],
          ['address', 'uint256', 'uint256']
        );
        const treeValueIndex = 0;
        const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
        await merkleFunder.connect(roles.randomPerson).deployMerkleFunderDepository(roles.owner.address, tree.root);
        await expect(
          merkleFunder
            .connect(roles.randomPerson)
            .fund(
              roles.owner.address,
              tree.root,
              tree.getProof(treeValueIndex),
              treeValue[0].toString(),
              treeValue[1],
              treeValue[2]
            )
        ).to.be.revertedWith('Recipient address zero');
      });
    });
  });

  describe('withdraw', function () {
    context('Recipient address is not zero', function () {
      context('Amount is not zero', function () {
        context('MerkleFunderDepository is deployed', function () {
          context('Balance is sufficient', function () {
            context('Transfer is successful', function () {
              it('withdraws', async function () {
                const { roles, merkleFunder, tree, merkleFunderDepository } = await loadFixture(
                  deployMerkleFunderAndMerkleFunderDepository
                );
                const amount = hre.ethers.utils.parseEther('1');
                const recipientBalance = await hre.ethers.provider.getBalance(roles.randomPerson.address);
                await expect(merkleFunder.connect(roles.owner).withdraw(tree.root, roles.randomPerson.address, amount))
                  .to.emit(merkleFunder, 'Withdrew')
                  .withArgs(merkleFunderDepository.address, roles.randomPerson.address, amount);
                expect(await hre.ethers.provider.getBalance(roles.randomPerson.address)).to.equal(
                  recipientBalance.add(amount)
                );
              });
            });
            context('Transfer is not successful', function () {
              it('reverts', async function () {
                const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunderAndMerkleFunderDepository);
                const amount = hre.ethers.utils.parseEther('1');
                await expect(
                  merkleFunder.connect(roles.owner).withdraw(tree.root, merkleFunder.address, amount)
                ).to.be.revertedWith('Transfer unsuccessful');
              });
            });
          });
          context('Balance is insufficient', function () {
            it('reverts', async function () {
              const { roles, merkleFunder, tree, merkleFunderDepository } = await loadFixture(
                deployMerkleFunderAndMerkleFunderDepository
              );
              const amount = (await hre.ethers.provider.getBalance(merkleFunderDepository.address)).add(1);
              await expect(
                merkleFunder.connect(roles.owner).withdraw(tree.root, roles.randomPerson.address, amount)
              ).to.be.revertedWith('Insufficient balance');
            });
          });
        });
        context('MerkleFunderDepository is not deployed', function () {
          it('reverts', async function () {
            const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunder);
            const amount = hre.ethers.utils.parseEther('1');
            await expect(
              merkleFunder.connect(roles.owner).withdraw(tree.root, roles.randomPerson.address, amount)
            ).to.be.revertedWith('No such MerkleFunderDepository');
          });
        });
      });
      context('Amount is zero', function () {
        it('reverts', async function () {
          const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunderAndMerkleFunderDepository);
          await expect(
            merkleFunder.connect(roles.owner).withdraw(tree.root, roles.randomPerson.address, 0)
          ).to.be.revertedWith('Amount zero');
        });
      });
    });
    context('Recipient address is zero', function () {
      it('reverts', async function () {
        const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunderAndMerkleFunderDepository);
        const amount = hre.ethers.utils.parseEther('1');
        await expect(
          merkleFunder.connect(roles.owner).withdraw(tree.root, hre.ethers.constants.AddressZero, amount)
        ).to.be.revertedWith('Recipient address zero');
      });
    });
  });

  describe('withdrawAll', function () {
    it('withdraws all', async function () {
      const { roles, merkleFunder, tree, merkleFunderDepository } = await loadFixture(
        deployMerkleFunderAndMerkleFunderDepository
      );
      const amount = await hre.ethers.provider.getBalance(merkleFunderDepository.address);
      const recipientBalance = await hre.ethers.provider.getBalance(roles.randomPerson.address);
      await expect(merkleFunder.connect(roles.owner).withdrawAll(tree.root, roles.randomPerson.address))
        .to.emit(merkleFunder, 'Withdrew')
        .withArgs(merkleFunderDepository.address, roles.randomPerson.address, amount);
      expect(await hre.ethers.provider.getBalance(roles.randomPerson.address)).to.equal(recipientBalance.add(amount));
    });
  });

  describe('computeMerkleFunderDepositoryAddress', function () {
    context('Root is not zero', function () {
      it('computes', async function () {
        const { roles, merkleFunder, tree } = await loadFixture(deployMerkleFunder);
        expect(await merkleFunder.computeMerkleFunderDepositoryAddress(roles.owner.address, tree.root)).to.equal(
          await computeMerkleFunderDepositoryAddress(merkleFunder.address, roles.owner.address, tree.root)
        );
      });
    });
    context('Root is zero', function () {
      it('reverts', async function () {
        const { roles, merkleFunder } = await loadFixture(deployMerkleFunder);
        await expect(
          merkleFunder
            .connect(roles.owner)
            .computeMerkleFunderDepositoryAddress(roles.owner.address, hre.ethers.constants.HashZero)
        ).to.be.revertedWith('Root zero');
      });
    });
  });
});
