import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployStaking } from '../../../scripts/deploy';
import type { PilgrimToken, XPilgrim } from '../../../typechain';
import type { Diamond, PilgrimTempleFacet } from '../../../typechain';
import { sleep } from '../../testUtils';

describe('PilgrimTemple', function () {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let staking: Diamond;

  let xPilgrim: XPilgrim;
  let pilgrim: PilgrimToken;
  let pilgrimTemple: PilgrimTempleFacet;


  before(async function () {
    signers = await ethers.getSigners();
    alice = signers[0]; // TODO: Don't use contract owner as test user
    bob = signers[1];
    carol = signers[2];
  });

  const deployAll = async function (lockupPeriod: number) {
    ({ pilgrim, xPilgrim, staking } = await deployStaking({ lockupPeriod }));

    pilgrimTemple = await ethers.getContractAt('PilgrimTempleFacet', staking.address);

    await xPilgrim.transferOwnership(pilgrimTemple.address);

    const mint = async (to: string, amount: string) => {
      await pilgrim.mint(amount);
      await pilgrim.transfer(to, amount);
    };
    await Promise.all([
      mint(alice.address, '100'),
      mint(bob.address, '100'),
      mint(carol.address, '100'),
    ]);
  };

  describe('enter()', function () {
    beforeEach(async () => {
      await deployAll(3600);
    });

    // STAKING_020201
    it('Enter increases locked Pilgrim amount', async function () {
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      expect(await pilgrimTemple.getLockedAmount(alice.address)).to.equal('100');
    });
  });

  describe('enter()', function () {
    beforeEach(async () => {
      await deployAll(0);
    });

    // STAKING_020201
    it('Enter increases locked Pilgrim amount', async function () {
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
    });

    // STAKING_020202
    it('Enter with insufficient Pilgrims approved', async function () {
      await expect(pilgrimTemple.enter('100')).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance',
      );
      await pilgrim.approve(pilgrimTemple.address, '50');
      await expect(pilgrimTemple.enter('100')).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance',
      );
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');

      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('100');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('100');
    });

    // STAKING_020203
    it('Enter with enough Pilgrims approved', async function () {
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
    });

    // STAKING_020204
    it('Enter returns proper xPilgrim tokens to sender', async function () {
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('100');
    });

    // STAKING_020205
    it('Enter increases Temple\'s Pilgrim balance', async function () {
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('100');
    });

    // STAKING_020206
    it('Unlocked Pilgrim amount increase after time expiration', async function () {
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      expect(await pilgrimTemple.getUnlockedAmount(alice.address)).to.equal('100');
    });
  });

  describe('leave()', function () {
    // STAKING_020301
    it('Leave with insufficient balance', async function () {
      await deployAll(0);
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await xPilgrim.transfer(bob.address, '1');
      await expect(pilgrimTemple.leave('100')).to.be.revertedWith(
        'ERC20: burn amount exceeds balance',
      );
    });

    // STAKING_020302
    it('Leave with insufficient entered amount', async function () {
      await deployAll(0);
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await expect(pilgrimTemple.leave('200')).to.be.revertedWith(
        'PilgrimTemple: leave amount exceeds unlocked balance',
      );
    });

    // STAKING_020303
    it('Leave with insufficient unlocked amount', async function () {
      await deployAll(3600);
      // should not allow withdrawing before lockup period expires
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await expect(pilgrimTemple.leave('100')).to.be.revertedWith(
        'PilgrimTemple: leave amount exceeds unlocked balance',
      );
    });

    // STAKING_020304
    it('Leave with sufficient unlocked amount', async function () {
      await deployAll(3);
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await sleep(3000);
      await pilgrimTemple.leave('100');
    });

    // STAKING_020305
    it('Leave reduces unlocked amount', async function () {
      await deployAll(0);
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await pilgrimTemple.leave('50');
      expect(await pilgrimTemple.getUnlockedAmount(alice.address)).to.equal('50');
      await pilgrimTemple.leave('50');
      expect(await pilgrimTemple.getUnlockedAmount(alice.address)).to.equal('0');
    });

    // STAKING_020306
    it('Leave burns xPilgrims of the sender', async function () {
      await deployAll(0);
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await pilgrimTemple.leave('50');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('50');
      await pilgrimTemple.leave('50');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('0');
    });

    // STAKING_020307
    it('Leave transfers Temple\'s Pilgrims to sender', async function () {
      await deployAll(0);
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('100');
      await expect(pilgrimTemple.leave('100'))
        .to.emit(pilgrim, 'Transfer')
        .withArgs(pilgrimTemple.address, alice.address, '100');
      expect(await pilgrim.balanceOf(alice.address)).to.equal('100');
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('0');
    });
  });


  describe('compounding Cases', async () => {
    // STAKING_020401
    it('should work with more than one participant', async function () {
      await deployAll(0);

      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrim
        .connect(bob)
        .approve(pilgrimTemple.address, '100', { from: bob.address });
      // Alice enters and gets 20 shares. Bob enters and gets 10 shares.
      await pilgrimTemple.enter('20');
      await pilgrimTemple.connect(bob).enter('10', { from: bob.address });
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('20');
      expect(await xPilgrim.balanceOf(bob.address)).to.equal('10');
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('30');
      // PilgrimTemple get 20 more PILs from an external source.
      await pilgrim
        .connect(carol)
        .transfer(pilgrimTemple.address, '20', { from: carol.address });
      // Alice deposits 10 more PILs. She should receive 10*30/50 = 6 shares.
      await pilgrimTemple.enter('10');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('26');
      expect(await xPilgrim.balanceOf(bob.address)).to.equal('10');
      // Bob withdraws 5 shares. He should receive 5*60/36 = 8 shares
      await pilgrimTemple.connect(bob).leave('5', { from: bob.address });
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('26');
      expect(await xPilgrim.balanceOf(bob.address)).to.equal('5');
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('52');
      expect(await pilgrim.balanceOf(alice.address)).to.equal('70');
      expect(await pilgrim.balanceOf(bob.address)).to.equal('98');
    });

    // STAKING_020402
    it('should work with more than one entry', async function () {
      await deployAll(3);
      // TODO: Any idea to ensure the lockup period has expired in javascript runtime?
      await pilgrim.approve(pilgrimTemple.address, '100');
      await pilgrimTemple.enter('50');
      await sleep(3000);
      await pilgrimTemple.enter('50');
      await pilgrimTemple.leave('50');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('50');
      await expect(pilgrimTemple.leave('50')).to.be.revertedWith(
        'PilgrimTemple: leave amount exceeds unlocked balance',
      );
      await sleep(3000);
      await pilgrimTemple.leave('50');
      expect(await xPilgrim.balanceOf(alice.address)).to.equal('0');
    });
  });
});
