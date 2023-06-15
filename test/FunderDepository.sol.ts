import * as hre from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('FunderDepository', function () {
  const deploy = async () => {
    const accounts = await hre.ethers.getSigners();
    const roles = {
      funder: accounts[0],
      owner: accounts[1],
      randomPerson: accounts[9],
    };

    const root = hre.ethers.utils.hexlify(hre.ethers.utils.randomBytes(32));

    const FunderDepository = await hre.ethers.getContractFactory('FunderDepository');
    const funderDepository = await FunderDepository.connect(roles.funder).deploy(roles.owner.address, root);

    return {
      roles,
      root,
      funderDepository,
    };
  };

  // Assert that the FunderDepository constructor does not validate its arguments
  describe('constructor', function () {
    context('Owner is not zero address', function () {
      context('Root is not zero', function () {
        it('constructs', async function () {
          const { roles, root, funderDepository } = await loadFixture(deploy);
          expect(await funderDepository.funder()).to.equal(roles.funder.address);
          expect(await funderDepository.owner()).to.equal(roles.owner.address);
          expect(await funderDepository.root()).to.equal(root);
        });
      });
      context('Root is zero', function () {
        it('constructs', async function () {
          const { roles } = await loadFixture(deploy);
          const FunderDepository = await hre.ethers.getContractFactory('FunderDepository');
          const funderDepository = await FunderDepository.deploy(roles.owner.address, hre.ethers.constants.HashZero);
          expect(await funderDepository.funder()).to.equal(roles.funder.address);
          expect(await funderDepository.owner()).to.equal(roles.owner.address);
          expect(await funderDepository.root()).to.equal(hre.ethers.constants.HashZero);
        });
      });
    });
    context('Owner is zero address', function () {
      it('constructs', async function () {
        const { roles, root } = await loadFixture(deploy);
        const FunderDepository = await hre.ethers.getContractFactory('FunderDepository');
        const funderDepository = await FunderDepository.deploy(hre.ethers.constants.AddressZero, root);
        expect(await funderDepository.funder()).to.equal(roles.funder.address);
        expect(await funderDepository.owner()).to.equal(hre.ethers.constants.AddressZero);
        expect(await funderDepository.root()).to.equal(root);
      });
    });
  });

  describe('receive', function () {
    it('receives', async function () {
      const { roles, funderDepository } = await loadFixture(deploy);
      const amount = hre.ethers.utils.parseEther('1');
      await roles.randomPerson.sendTransaction({
        to: funderDepository.address,
        value: amount,
      });
      expect(await hre.ethers.provider.getBalance(funderDepository.address)).to.equal(amount);
    });
  });

  describe('withdraw', function () {
    context('Sender is Funder', function () {
      context('Transfer is successful', function () {
        it('withdraws', async function () {
          const { roles, funderDepository } = await loadFixture(deploy);
          const amount = hre.ethers.utils.parseEther('1');
          await roles.randomPerson.sendTransaction({
            to: funderDepository.address,
            value: amount,
          });
          const balanceBefore = await hre.ethers.provider.getBalance(roles.randomPerson.address);
          await funderDepository.connect(roles.funder).withdraw(roles.randomPerson.address, amount);
          const balanceAfter = await hre.ethers.provider.getBalance(roles.randomPerson.address);
          expect(balanceAfter.sub(balanceBefore)).to.equal(amount);
        });
      });
      context('Transfer is not successful', function () {
        it('reverts', async function () {
          const { roles, funderDepository } = await loadFixture(deploy);
          const amount = hre.ethers.utils.parseEther('1');
          await expect(
            funderDepository.connect(roles.funder).withdraw(roles.randomPerson.address, amount)
          ).to.be.revertedWith('Transfer unsuccessful');
        });
      });
    });
    context('Sender is not Funder', function () {
      it('reverts', async function () {
        const { roles, funderDepository } = await loadFixture(deploy);
        const amount = hre.ethers.utils.parseEther('1');
        await expect(
          funderDepository.connect(roles.randomPerson).withdraw(roles.randomPerson.address, amount)
        ).to.be.revertedWith('Sender not Funder');
      });
    });
  });
});
