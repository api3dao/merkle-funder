import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import * as hre from "hardhat";
import { computeFunderDepositoryAddress } from "../src";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Funder", function () {
  const deployFunder = async () => {
    const accounts = await hre.ethers.getSigners();
    const roles = {
      deployer: accounts[0],
      owner: accounts[1],
      recipient1: accounts[2],
      recipient2: accounts[3],
      recipient3: accounts[4],
      randomPerson: accounts[9],
    };

    const Funder = await hre.ethers.getContractFactory(
      "Funder",
      roles.deployer
    );
    const funder = await Funder.deploy();

    const treeValues = await Promise.all(
      [
        roles.recipient1.address,
        roles.recipient2.address,
        roles.recipient3.address,
      ].map(async (recipientAddress) => {
        const recipientBalance = await hre.ethers.provider.getBalance(
          recipientAddress
        );
        const lowThreshold = recipientBalance.add(
          hre.ethers.utils.parseEther(
            (Math.floor(Math.random() * 10) + 1).toString()
          )
        );
        const highThreshold = lowThreshold.add(
          hre.ethers.utils.parseEther(
            (Math.floor(Math.random() * 10) + 1).toString()
          )
        );
        return [recipientAddress, lowThreshold, highThreshold];
      })
    );
    const tree = StandardMerkleTree.of(treeValues, [
      "address",
      "uint256",
      "uint256",
    ]);

    return {
      roles,
      funder,
      tree,
    };
  };

  const deployFunderAndFunderDepository = async () => {
    const { roles, funder, tree } = await deployFunder();
    const funderDepositoryAddress = await computeFunderDepositoryAddress(
      funder.address,
      roles.owner.address,
      tree.root
    );
    await funder
      .connect(roles.randomPerson)
      .deployFunderDepository(roles.owner.address, tree.root);
    const funderDepository = await hre.ethers.getContractAt(
      "FunderDepository",
      funderDepositoryAddress
    );
    await roles.randomPerson.sendTransaction({
      to: funderDepository.address,
      value: hre.ethers.utils.parseEther("100"),
    });
    return {
      roles,
      funder,
      tree,
      funderDepository,
    };
  };

  describe("deployFunderDepository", function () {
    context("Root is not zero", function () {
      context("FunderDepository has not been deployed before", function () {
        it("deploys FunderDepository", async function () {
          const { roles, funder, tree } = await loadFixture(deployFunder);
          const funderDepositoryAddress = await computeFunderDepositoryAddress(
            funder.address,
            roles.owner.address,
            tree.root
          );
          await expect(
            funder
              .connect(roles.randomPerson)
              .deployFunderDepository(roles.owner.address, tree.root)
          )
            .to.emit(funder, "DeployedFunderDepository")
            .withArgs(funderDepositoryAddress, roles.owner.address, tree.root);
          expect(
            await funder.ownerToRootToFunderDepositoryAddress(
              roles.owner.address,
              tree.root
            )
          ).to.equal(funderDepositoryAddress);
          const funderDepository = await hre.ethers.getContractAt(
            "FunderDepository",
            funderDepositoryAddress
          );
          expect(await funderDepository.funder()).to.equal(funder.address);
          expect(await funderDepository.owner()).to.equal(roles.owner.address);
          expect(await funderDepository.root()).to.equal(tree.root);
        });
      });
      context("FunderDepository has been deployed before", function () {
        it("reverts", async function () {
          const { roles, funder, tree } = await loadFixture(deployFunder);
          await funder
            .connect(roles.randomPerson)
            .deployFunderDepository(roles.owner.address, tree.root);
          await expect(
            funder
              .connect(roles.randomPerson)
              .deployFunderDepository(roles.owner.address, tree.root)
          ).to.be.revertedWithoutReason;
        });
      });
    });
    context("Root is zero", function () {
      it("reverts", async function () {
        const { roles, funder } = await loadFixture(deployFunder);
        await expect(
          funder
            .connect(roles.owner)
            .deployFunderDepository(
              roles.owner.address,
              hre.ethers.constants.HashZero
            )
        ).to.be.revertedWith("Root zero");
      });
    });
  });

  describe("fund", function () {
    context("Recipient address is not zero", function () {
      context("Low threshold is not higher than high", function () {
        context("High threshold is not zero", function () {
          context("Proof is valid", function () {
            context("Balance is low enough", function () {
              context("Amount is not zero", function () {
                context("Respective FunderDepository is deployed", function () {
                  context("Transfer is successful", function () {
                    it("funds", async function () {
                      const { roles, funder, tree, funderDepository } =
                        await loadFixture(deployFunderAndFunderDepository);
                      await Promise.all(
                        Array.from(tree.entries()).map(
                          async ([treeValueIndex, treeValue]) => {
                            const recipientBalance =
                              await hre.ethers.provider.getBalance(
                                treeValue[0].toString()
                              );
                            const amountNeededToTopUp =
                              hre.ethers.BigNumber.from(treeValue[2]).sub(
                                recipientBalance
                              );
                            // Note that we use `tree.getProof(treeValueIndex)` and not `tree.getProof(treeValue.treeIndex)`
                            await expect(
                              funder
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
                              .to.emit(funder, "Funded")
                              .withArgs(
                                funderDepository.address,
                                treeValue[0].toString(),
                                amountNeededToTopUp
                              );
                            expect(
                              await hre.ethers.provider.getBalance(
                                treeValue[0].toString()
                              )
                            ).to.equal(
                              recipientBalance.add(amountNeededToTopUp)
                            );
                          }
                        )
                      );
                    });
                  });
                  context("Transfer is not successful", function () {
                    it("reverts", async function () {
                      const { roles, funder } = await loadFixture(deployFunder);
                      const tree = StandardMerkleTree.of(
                        [[funder.address, 1, 2]],
                        ["address", "uint256", "uint256"]
                      );
                      const treeValueIndex = 0;
                      const [, treeValue] = Array.from(tree.entries())[
                        treeValueIndex
                      ];
                      await funder
                        .connect(roles.randomPerson)
                        .deployFunderDepository(roles.owner.address, tree.root);
                      const funderDepositoryAddress =
                        await computeFunderDepositoryAddress(
                          funder.address,
                          roles.owner.address,
                          tree.root
                        );
                      await roles.randomPerson.sendTransaction({
                        to: funderDepositoryAddress,
                        value: hre.ethers.utils.parseEther("100"),
                      });
                      await expect(
                        funder
                          .connect(roles.randomPerson)
                          .fund(
                            roles.owner.address,
                            tree.root,
                            tree.getProof(treeValueIndex),
                            treeValue[0].toString(),
                            treeValue[1],
                            treeValue[2]
                          )
                      ).to.be.revertedWith("Transfer unsuccessful");
                    });
                  });
                });
                context(
                  "Respective FunderDepository is not deployed",
                  function () {
                    it("reverts", async function () {
                      const { roles, funder, tree } = await loadFixture(
                        deployFunder
                      );
                      const treeValueIndex = 0;
                      const [, treeValue] = Array.from(tree.entries())[
                        treeValueIndex
                      ];
                      const funderDepositoryAddress =
                        await computeFunderDepositoryAddress(
                          funder.address,
                          roles.owner.address,
                          tree.root
                        );
                      await roles.randomPerson.sendTransaction({
                        to: funderDepositoryAddress,
                        value: hre.ethers.utils.parseEther("100"),
                      });
                      await expect(
                        funder
                          .connect(roles.randomPerson)
                          .fund(
                            roles.owner.address,
                            tree.root,
                            tree.getProof(treeValueIndex),
                            treeValue[0].toString(),
                            treeValue[1],
                            treeValue[2]
                          )
                      ).to.be.revertedWith("No such FunderDepository");
                    });
                  }
                );
              });
              context("Amount is zero", function () {
                it("reverts", async function () {
                  const { roles, funder, tree } = await loadFixture(
                    deployFunder
                  );
                  const treeValueIndex = 0;
                  const [, treeValue] = Array.from(tree.entries())[
                    treeValueIndex
                  ];
                  await funder
                    .connect(roles.randomPerson)
                    .deployFunderDepository(roles.owner.address, tree.root);
                  await expect(
                    funder
                      .connect(roles.randomPerson)
                      .fund(
                        roles.owner.address,
                        tree.root,
                        tree.getProof(treeValueIndex),
                        treeValue[0].toString(),
                        treeValue[1],
                        treeValue[2]
                      )
                  ).to.be.revertedWith("Amount zero");
                });
              });
            });
            context("Balance is not low enough", function () {
              it("reverts", async function () {
                const { roles, funder, tree } = await loadFixture(
                  deployFunderAndFunderDepository
                );
                const treeValueIndex = 0;
                const [, treeValue] = Array.from(tree.entries())[
                  treeValueIndex
                ];
                const recipientBalance = await hre.ethers.provider.getBalance(
                  treeValue[0].toString()
                );
                const amountNeededToExceedLowThreshold =
                  hre.ethers.BigNumber.from(treeValue[1])
                    .sub(recipientBalance)
                    .add(1);
                await roles.randomPerson.sendTransaction({
                  to: treeValue[0].toString(),
                  value: amountNeededToExceedLowThreshold,
                });
                await expect(
                  funder
                    .connect(roles.randomPerson)
                    .fund(
                      roles.owner.address,
                      tree.root,
                      tree.getProof(treeValueIndex),
                      treeValue[0].toString(),
                      treeValue[1],
                      treeValue[2]
                    )
                ).to.be.revertedWith("Balance not low enough");
              });
            });
          });
          context("Proof is not valid", function () {
            it("reverts", async function () {
              const { roles, funder, tree } = await loadFixture(
                deployFunderAndFunderDepository
              );
              const treeValueIndex = 0;
              const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
              await expect(
                funder
                  .connect(roles.randomPerson)
                  .fund(
                    roles.owner.address,
                    tree.root,
                    [
                      hre.ethers.utils.hexlify(
                        hre.ethers.utils.randomBytes(32)
                      ),
                    ],
                    treeValue[0].toString(),
                    treeValue[1],
                    treeValue[2]
                  )
              ).to.be.revertedWith("Invalid proof");
            });
          });
        });
        context("High threshold is zero", function () {
          it("reverts", async function () {
            const { roles, funder } = await loadFixture(deployFunder);
            const tree = StandardMerkleTree.of(
              [[roles.recipient1.address, 0, 0]],
              ["address", "uint256", "uint256"]
            );
            const treeValueIndex = 0;
            const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
            await funder
              .connect(roles.randomPerson)
              .deployFunderDepository(roles.owner.address, tree.root);
            await expect(
              funder
                .connect(roles.randomPerson)
                .fund(
                  roles.owner.address,
                  tree.root,
                  tree.getProof(treeValueIndex),
                  treeValue[0].toString(),
                  treeValue[1],
                  treeValue[2]
                )
            ).to.be.revertedWith("High threshold zero");
          });
        });
      });
      context("Low threshold is higher than high", function () {
        it("reverts", async function () {
          const { roles, funder } = await loadFixture(deployFunder);
          const tree = StandardMerkleTree.of(
            [[roles.recipient1.address, 2, 1]],
            ["address", "uint256", "uint256"]
          );
          const treeValueIndex = 0;
          const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
          await funder
            .connect(roles.randomPerson)
            .deployFunderDepository(roles.owner.address, tree.root);
          await expect(
            funder
              .connect(roles.randomPerson)
              .fund(
                roles.owner.address,
                tree.root,
                tree.getProof(treeValueIndex),
                treeValue[0].toString(),
                treeValue[1],
                treeValue[2]
              )
          ).to.be.revertedWith("Low threshold higher than high");
        });
      });
    });
    context("Recipient address is zero", function () {
      it("reverts", async function () {
        const { roles, funder } = await loadFixture(deployFunder);
        const tree = StandardMerkleTree.of(
          [[hre.ethers.constants.AddressZero, 1, 2]],
          ["address", "uint256", "uint256"]
        );
        const treeValueIndex = 0;
        const [, treeValue] = Array.from(tree.entries())[treeValueIndex];
        await funder
          .connect(roles.randomPerson)
          .deployFunderDepository(roles.owner.address, tree.root);
        await expect(
          funder
            .connect(roles.randomPerson)
            .fund(
              roles.owner.address,
              tree.root,
              tree.getProof(treeValueIndex),
              treeValue[0].toString(),
              treeValue[1],
              treeValue[2]
            )
        ).to.be.revertedWith("Recipient address zero");
      });
    });
  });

  describe("withdraw", function () {
    context("Recipient address is not zero", function () {
      context("Amount is not zero", function () {
        context("FunderDepository is deployed", function () {
          context("Balance is sufficient", function () {
            context("Transfer is successful", function () {
              it("withdraws", async function () {
                const { roles, funder, tree, funderDepository } =
                  await loadFixture(deployFunderAndFunderDepository);
                const amount = hre.ethers.utils.parseEther("1");
                const recipientBalance = await hre.ethers.provider.getBalance(
                  roles.randomPerson.address
                );
                await expect(
                  funder
                    .connect(roles.owner)
                    .withdraw(tree.root, roles.randomPerson.address, amount)
                )
                  .to.emit(funder, "Withdrew")
                  .withArgs(
                    funderDepository.address,
                    roles.randomPerson.address,
                    amount
                  );
                expect(
                  await hre.ethers.provider.getBalance(
                    roles.randomPerson.address
                  )
                ).to.equal(recipientBalance.add(amount));
              });
            });
            context("Transfer is not successful", function () {
              it("reverts", async function () {
                const { roles, funder, tree } = await loadFixture(
                  deployFunderAndFunderDepository
                );
                const amount = hre.ethers.utils.parseEther("1");
                await expect(
                  funder
                    .connect(roles.owner)
                    .withdraw(tree.root, funder.address, amount)
                ).to.be.revertedWith("Transfer unsuccessful");
              });
            });
          });
          context("Balance is insufficient", function () {
            it("reverts", async function () {
              const { roles, funder, tree, funderDepository } =
                await loadFixture(deployFunderAndFunderDepository);
              const amount = (
                await hre.ethers.provider.getBalance(funderDepository.address)
              ).add(1);
              await expect(
                funder
                  .connect(roles.owner)
                  .withdraw(tree.root, roles.randomPerson.address, amount)
              ).to.be.revertedWith("Insufficient balance");
            });
          });
        });
        context("FunderDepository is not deployed", function () {
          it("reverts", async function () {
            const { roles, funder, tree } = await loadFixture(deployFunder);
            const amount = hre.ethers.utils.parseEther("1");
            await expect(
              funder
                .connect(roles.owner)
                .withdraw(tree.root, roles.randomPerson.address, amount)
            ).to.be.revertedWith("No such FunderDepository");
          });
        });
      });
      context("Amount is zero", function () {
        it("reverts", async function () {
          const { roles, funder, tree } = await loadFixture(
            deployFunderAndFunderDepository
          );
          await expect(
            funder
              .connect(roles.owner)
              .withdraw(tree.root, roles.randomPerson.address, 0)
          ).to.be.revertedWith("Amount zero");
        });
      });
    });
    context("Recipient address is zero", function () {
      it("reverts", async function () {
        const { roles, funder, tree } = await loadFixture(
          deployFunderAndFunderDepository
        );
        const amount = hre.ethers.utils.parseEther("1");
        await expect(
          funder
            .connect(roles.owner)
            .withdraw(tree.root, hre.ethers.constants.AddressZero, amount)
        ).to.be.revertedWith("Recipient address zero");
      });
    });
  });

  describe("withdrawAll", function () {
    it("withdraws all", async function () {
      const { roles, funder, tree, funderDepository } = await loadFixture(
        deployFunderAndFunderDepository
      );
      const amount = await hre.ethers.provider.getBalance(
        funderDepository.address
      );
      const recipientBalance = await hre.ethers.provider.getBalance(
        roles.randomPerson.address
      );
      await expect(
        funder
          .connect(roles.owner)
          .withdrawAll(tree.root, roles.randomPerson.address)
      )
        .to.emit(funder, "Withdrew")
        .withArgs(funderDepository.address, roles.randomPerson.address, amount);
      expect(
        await hre.ethers.provider.getBalance(roles.randomPerson.address)
      ).to.equal(recipientBalance.add(amount));
    });
  });

  describe("computeFunderDepositoryAddress", function () {
    context("Root is not zero", function () {
      it("computes", async function () {
        const { roles, funder, tree } = await loadFixture(deployFunder);
        expect(
          await funder.computeFunderDepositoryAddress(
            roles.owner.address,
            tree.root
          )
        ).to.equal(
          await computeFunderDepositoryAddress(
            funder.address,
            roles.owner.address,
            tree.root
          )
        );
      });
    });
    context("Root is zero", function () {
      it("reverts", async function () {
        const { roles, funder } = await loadFixture(deployFunder);
        await expect(
          funder
            .connect(roles.owner)
            .computeFunderDepositoryAddress(
              roles.owner.address,
              hre.ethers.constants.HashZero
            )
        ).to.be.revertedWith("Root zero");
      });
    });
  });
});
