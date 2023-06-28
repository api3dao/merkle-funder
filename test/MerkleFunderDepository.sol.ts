import * as hre from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('MerkleFunderDepository', function () {
  const deploy = async () => {
    const accounts = await hre.ethers.getSigners();
    const roles = {
      merkleFunder: accounts[0],
      owner: accounts[1],
      randomPerson: accounts[9],
    };

    const root = hre.ethers.utils.hexlify(hre.ethers.utils.randomBytes(32));

    const MerkleFunderDepository = await hre.ethers.getContractFactory('MerkleFunderDepository');
    const merkleFunderDepository = await MerkleFunderDepository.connect(roles.merkleFunder).deploy(
      roles.owner.address,
      root
    );

    return {
      roles,
      root,
      merkleFunderDepository,
    };
  };

  // Assert that the MerkleFunderDepository constructor does not validate its arguments
  describe('constructor', function () {
    context('Owner is not zero address', function () {
      context('Root is not zero', function () {
        it('constructs', async function () {
          const { roles, root, merkleFunderDepository } = await loadFixture(deploy);
          expect(await merkleFunderDepository.merkleFunder()).to.equal(roles.merkleFunder.address);
          expect(await merkleFunderDepository.owner()).to.equal(roles.owner.address);
          expect(await merkleFunderDepository.root()).to.equal(root);
        });
      });
      context('Root is zero', function () {
        it('constructs', async function () {
          const { roles } = await loadFixture(deploy);
          const MerkleFunderDepository = await hre.ethers.getContractFactory('MerkleFunderDepository');
          const merkleFunderDepository = await MerkleFunderDepository.deploy(
            roles.owner.address,
            hre.ethers.constants.HashZero
          );
          expect(await merkleFunderDepository.merkleFunder()).to.equal(roles.merkleFunder.address);
          expect(await merkleFunderDepository.owner()).to.equal(roles.owner.address);
          expect(await merkleFunderDepository.root()).to.equal(hre.ethers.constants.HashZero);
        });
      });
    });
    context('Owner is zero address', function () {
      it('constructs', async function () {
        const { roles, root } = await loadFixture(deploy);
        const MerkleFunderDepository = await hre.ethers.getContractFactory('MerkleFunderDepository');
        const merkleFunderDepository = await MerkleFunderDepository.deploy(hre.ethers.constants.AddressZero, root);
        expect(await merkleFunderDepository.merkleFunder()).to.equal(roles.merkleFunder.address);
        expect(await merkleFunderDepository.owner()).to.equal(hre.ethers.constants.AddressZero);
        expect(await merkleFunderDepository.root()).to.equal(root);
      });
    });
  });

  describe('receive', function () {
    it('receives', async function () {
      const { roles, merkleFunderDepository } = await loadFixture(deploy);
      const amount = hre.ethers.utils.parseEther('1');
      await roles.randomPerson.sendTransaction({
        to: merkleFunderDepository.address,
        value: amount,
      });
      expect(await hre.ethers.provider.getBalance(merkleFunderDepository.address)).to.equal(amount);
    });
  });

  describe('transfer', function () {
    context('Sender is MerkleFunder', function () {
      context('Transfer is successful', function () {
        it('transfers', async function () {
          const { roles, merkleFunderDepository } = await loadFixture(deploy);
          const amount = hre.ethers.utils.parseEther('1');
          await roles.randomPerson.sendTransaction({
            to: merkleFunderDepository.address,
            value: amount,
          });
          const balanceBefore = await hre.ethers.provider.getBalance(roles.randomPerson.address);
          await merkleFunderDepository.connect(roles.merkleFunder).transfer(roles.randomPerson.address, amount);
          const balanceAfter = await hre.ethers.provider.getBalance(roles.randomPerson.address);
          expect(balanceAfter.sub(balanceBefore)).to.equal(amount);
        });
      });
      context('Transfer is not successful', function () {
        it('reverts', async function () {
          const { roles, merkleFunderDepository } = await loadFixture(deploy);
          const amount = hre.ethers.utils.parseEther('1');
          await expect(
            merkleFunderDepository.connect(roles.merkleFunder).transfer(roles.randomPerson.address, amount)
          ).to.be.revertedWithCustomError(merkleFunderDepository, 'TransferUnsuccessful');
        });
      });
    });
    context('Sender is not MerkleFunder', function () {
      it('reverts', async function () {
        const { roles, merkleFunderDepository } = await loadFixture(deploy);
        const amount = hre.ethers.utils.parseEther('1');
        await expect(
          merkleFunderDepository.connect(roles.randomPerson).transfer(roles.randomPerson.address, amount)
        ).to.be.revertedWithCustomError(merkleFunderDepository, 'SenderNotMerkleFunder');
      });
    });
  });
});
