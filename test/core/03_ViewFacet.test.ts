import { expect } from 'chai';
import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';

import { deployAll } from '../../scripts/deploy/index';
import {
  Diamond,
  ERC20Mock,
  ERC721Mock,
  ListingFacet,
  ManagingFacet,
  PilgrimMetaNFT,
  PilgrimToken,
  ViewFacet,
} from '../../typechain';
import { deadline, dummyIpfsHash, listingPrice, mintNft, oneEther, runRWMethod, zeroAddr } from '../testUtils';

describe('ViewFacet', function () {
  let core: Diamond;
  let pilgrimMetaNFT: PilgrimMetaNFT;
  let pilgrim: PilgrimToken;
  let listingFacet: ListingFacet;
  let managingFacet: ManagingFacet;
  let viewFacet: ViewFacet;

  let erc20: ERC20Mock;
  let erc721: ERC721Mock;

  let user: Signer;
  let userAddr: string;

  this.beforeEach(async function () {
    ({ core, pilgrim, pilgrimMetaNFT } = await deployAll());

    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);
    viewFacet = await ethers.getContractAt('ViewFacet', core.address);

    erc20 = await (await ethers.getContractFactory('ERC20Mock')).deploy('TestToken', 'TEST', oneEther.mul(1_000_000_000));
    erc721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestNFT', 'TNFT');

    await managingFacet.createPool(erc20.address, 1, 0);

    [, user] = await ethers.getSigners();
    userAddr = await user.getAddress();
  });

  // Get latest version of MetaNFT ID with listed NFT ID
  it('CORE_030101', async function (): Promise<void> {
    const tokenId = await mintNft(erc721, user);

    for (let i = 0; i < 3; i++) {
      await erc721.connect(user).approve(core.address, tokenId);
      const listResult = await runRWMethod({
        method: listingFacet
          .connect(user)
          .list(erc721.address, tokenId, listingPrice, erc20.address, [], dummyIpfsHash),
        name: 'List',
      });
      const metaNftId = listResult._metaNftId;
      expect(await viewFacet['getMetaNftId(address,uint256)'](erc721.address, tokenId)).to.equal(metaNftId);
      await pilgrimMetaNFT.connect(user).approve(core.address, metaNftId);
      await listingFacet.connect(user).delist(metaNftId, 0, deadline);
    }
  });

  // Get MetaNFT ID with non-listed NFT ID
  it('CORE_030102', async function (): Promise<void> {
    await expect(viewFacet['getMetaNftId(address,uint256)'](erc721.address, 0)).to.be.revertedWith('Pilgrim: Pair Not Found');
  });

  // Get specific version of MetaNFT ID with NFT ID
  it('CORE_030201', async function (): Promise<void> {
    const tokenId = await mintNft(erc721, user);

    const metaNftIds: Array<BigNumber> = [];

    for (let i = 0; i < 3; i++) {
      await erc721.connect(user).approve(core.address, tokenId);
      const listResult = await runRWMethod({
        method: listingFacet
          .connect(user)
          .list(erc721.address, tokenId, listingPrice, erc20.address, [], dummyIpfsHash),
        name: 'List',
      });
      const metaNftId = listResult._metaNftId;
      metaNftIds.push(metaNftId);
      await pilgrimMetaNFT.connect(user).approve(core.address, metaNftId);
      await listingFacet.connect(user).delist(metaNftId, 0, deadline);
    }

    for (let i = 0; i < 3; i++) {
      expect(await viewFacet['getMetaNftId(address,uint256,uint32)'](erc721.address, tokenId, i)).to.equal(metaNftIds[i]);
    }
  });

  // Get MetaNFT ID with non-listed NFT ID
  it('CORE_030202', async function (): Promise<void> {
    await expect(viewFacet['getMetaNftId(address,uint256,uint32)'](erc721.address, 0, 0)).to.be.revertedWith('Pilgrim: Pair Not Found');
  });

  // Get MetaNFT ID with invalid version
  it('CORE_030203', async function (): Promise<void> {
    const tokenId = await mintNft(erc721, user);
    await erc721.connect(user).approve(core.address, tokenId);
    await runRWMethod({
      method: listingFacet
        .connect(user)
        .list(erc721.address, tokenId, listingPrice, erc20.address, [], dummyIpfsHash),
      name: 'List',
    });
    await expect(viewFacet['getMetaNftId(address,uint256,uint32)'](erc721.address, tokenId, 1)).to.be.revertedWith('Pilgrim: Invalid Pair Version');
  });

  // Get PairInfo with listed MetaNFT ID
  it('CORE_030301', async function (): Promise<void> {
    const tokenId = await mintNft(erc721, user);
    await erc721.connect(user).approve(core.address, tokenId);
    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user)
        .list(erc721.address, tokenId, listingPrice, erc20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;
    const pairInfo = await viewFacet.getPairInfo(metaNftId);
    expect(pairInfo._nftAddress).to.equal(erc721.address);
    expect(pairInfo._tokenId).to.equal(tokenId);
    expect(pairInfo._version).to.equal(0);
    expect(pairInfo._descriptionHash).to.equal(dummyIpfsHash);
  });

  // Get PairInfo with non-listed MetaNFT ID
  it('CORE_030302', async function (): Promise<void> {
    const pairInfo = await viewFacet.getPairInfo(0);
    expect(pairInfo._nftAddress).to.equal(zeroAddr);
    expect(pairInfo._tokenId).to.equal(0);
    expect(pairInfo._version).to.equal(0);
    expect(pairInfo._descriptionHash).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
  });

  // Get bidTimeout
  it('CORE_030401', async function (): Promise<void> {
    expect(await viewFacet.getBidTimeout()).to.equal(60 * 60 * 6); // default value is 6 hours
  });

  // Get uniV3ExtraRewardParam
  // Get uniV3ExtraRewardParam with unsorted token addresses
  // Set uniV3ExtraRewardParam
  it('CORE_030501_CORE_030502_CORE_050701', async function (): Promise<void> {
    const univ3ExtraRewardParam = Math.ceil(Math.random() * 10);
    await managingFacet.setUniV3ExtraRewardParam(
      pilgrim.address,
      erc20.address,
      univ3ExtraRewardParam,
    );
    expect(await viewFacet.getUniV3ExtraRewardParam(pilgrim.address, erc20.address))
      .to.equal(univ3ExtraRewardParam);
    expect(await viewFacet.getUniV3ExtraRewardParam(erc20.address, pilgrim.address))
      .to.equal(univ3ExtraRewardParam);
  });

  // Get uniV3ExtraRewardParam with unregistered token addresses
  it('CORE_030503', async function (): Promise<void> {
    expect(await viewFacet.getUniV3ExtraRewardParam(pilgrim.address, erc20.address))
      .to.equal(0);
  });

  // Get the base fee numerator
  it('CORE_030701', async function (): Promise<void> {
    expect(await viewFacet.getBaseFee()).to.equal(1);
  });

  // Get the round fee numerator
  it('CORE_030801', async function (): Promise<void> {
    expect(await viewFacet.getRoundFee()).to.equal(4);
  });

  // Get the NFT/metaNFT fee numerator
  it('CORE_030901', async function (): Promise<void> {
    expect(await viewFacet.getNftFee()).to.equal(25);
  });
});
