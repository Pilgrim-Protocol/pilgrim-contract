import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import type { XPilgrim } from '../../typechain';

describe('XPilgrim', function () {
  let xPil: XPilgrim;

  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  before(async function () {
    this.XPilgrim = await ethers.getContractFactory('XPilgrim');

    signers = await ethers.getSigners();
    alice = signers[0];
    bob = signers[1];
    carol = signers[2];
  });

  beforeEach(async function () {
    xPil = await this.XPilgrim.deploy();
    await xPil.deployed();
  });

  it('should have correct name and symbol and decimal', async function () {
    const name = await xPil.name();
    const symbol = await xPil.symbol();
    const decimals = await xPil.decimals();
    expect(name).to.be.equal( 'xPilgrim');
    expect(symbol).to.be.equal( 'xPIL');
    expect(decimals).to.be.equal( 18);
  });

  it('should only allow owner to mint token', async function () {
    await xPil.mint(alice.address, '100');
    await xPil.mint(bob.address, '1000');
    await expect(xPil.connect(bob).mint(carol.address, '1000', { from: bob.address })).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
    const totalSupply = await xPil.totalSupply();
    const aliceBal = await xPil.balanceOf(alice.address);
    const bobBal = await xPil.balanceOf(bob.address);
    const carolBal = await xPil.balanceOf(carol.address);
    expect(totalSupply).to.equal('1100');
    expect(aliceBal).to.equal('100');
    expect(bobBal).to.equal('1000');
    expect(carolBal).to.equal('0');
  });

  it('should only allow owner to burn token', async function () {
    await xPil.mint(alice.address, '100');
    await xPil.mint(bob.address, '1000');

    await xPil.burn(bob.address, '1000');
    await expect(xPil.connect(bob).burn(alice.address, '1000', { from: bob.address })).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );

    const totalSupply = await xPil.totalSupply();
    const aliceBal = await xPil.balanceOf(alice.address);
    const bobBal = await xPil.balanceOf(bob.address);
    expect(totalSupply).to.equal('100');
    expect(aliceBal).to.equal('100');
    expect(bobBal).to.equal('0');
  });

  it('should supply token transfers properly', async function () {
    await xPil.mint(alice.address, '100');
    await xPil.mint(bob.address, '1000');
    await xPil.transfer(carol.address, '10');
    await xPil.connect(bob).transfer(carol.address, '100', {
      from: bob.address,
    });
    const totalSupply = await xPil.totalSupply();
    const aliceBal = await xPil.balanceOf(alice.address);
    const bobBal = await xPil.balanceOf(bob.address);
    const carolBal = await xPil.balanceOf(carol.address);
    expect(totalSupply, '1100');
    expect(aliceBal, '90');
    expect(bobBal, '900');
    expect(carolBal, '110');
  });

  it('should fail if you try to do bad transfers', async function () {
    await xPil.mint(alice.address, '100');
    await expect(xPil.transfer(carol.address, '110')).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    await expect(xPil.connect(bob).transfer(carol.address, '1', { from: bob.address })).to.be.revertedWith(
      'ERC20: transfer amount exceeds balance',
    );
  });
});
