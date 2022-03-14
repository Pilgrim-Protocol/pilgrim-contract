import {
  BigNumberish,
  ContractReceipt,
  Signer,
} from 'ethers';
import { ethers } from 'hardhat';

import { deployAll } from '../../../scripts/deploy/index';
import {
  AMMFacet,
  Diamond,
  ListingFacet,
  ManagingFacet,
  ERC20Mock,
  ERC721Mock,
  PilgrimMetaNFT,
} from '../../../typechain';
import {
  deadline,
  dummyIpfsHash,
  getEventArgs,
  invalidNftAddr, listingPrice,
  maxInitPrice,
  oneEther,
  runRWMethod,
  zeroAddr,
} from '../../testUtils';

describe('list', function () {
  let admin: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  let user4: Signer;
  let user5: Signer;
  // let adminAddr: string;
  let user1Addr: string;
  let user2Addr: string;
  let user3Addr: string;
  let user4Addr: string;
  let user5Addr: string;

  let testERC20: ERC20Mock;
  let testERC721: ERC721Mock;
  let tokenId: number;

  let core: Diamond;
  let pilgrimMetaNFT: PilgrimMetaNFT;

  let aMMFacet: AMMFacet;
  let listingFacet: ListingFacet;
  // let viewFacet: ViewFacet;
  let managingFacet: ManagingFacet;

  this.beforeEach(async function () {
    // @ts-ignore
    ({ core, pilgrimMetaNFT, testERC20 } = await deployAll());

    aMMFacet = await ethers.getContractAt('AMMFacet', core.address);
    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    // viewFacet = await ethers.getContractAt("ViewFacet", core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);

    [admin, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // adminAddr = await admin.getAddress();
    user1Addr = await user1.getAddress();
    user2Addr = await user2.getAddress();
    user3Addr = await user3.getAddress();
    user4Addr = await user4.getAddress();
    user5Addr = await user5.getAddress();

    testERC721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestERC721', 'TERC721');

    const mintReceipt: ContractReceipt = await (
      await testERC721.safeMint(user1Addr)
    ).wait();
    tokenId = getEventArgs(mintReceipt, 'Transfer')!.tokenId;
    await testERC721.connect(user1).approve(core.address, tokenId);
    await testERC20.connect(admin).transfer(user1Addr, oneEther.mul(100_000));
    await testERC20.connect(admin).transfer(user2Addr, oneEther.mul(100_000));
    await testERC20.connect(admin).transfer(user3Addr, oneEther.mul(100_000));
    await testERC20.connect(admin).transfer(user4Addr, oneEther.mul(100_000));
    await testERC20.connect(admin).transfer(user5Addr, oneEther.mul(100_000));
    await managingFacet.createPool(testERC20.address, 1, 0);
  });

  // List with max _initPrice
  it('CORE_020501', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = maxInitPrice;
    const expectedMetaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectedArgs: {
        _nftAddress: testERC721.address,
        _tokenId: tokenId,
        _metaNftId: expectedMetaNftId,
        _tags: {},
      },
    });
  });

  // List with empty _tags array
  it('CORE_020502', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;
    const expectedMetaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectedArgs: {
        _nftAddress: testERC721.address,
        _tokenId: tokenId,
        _metaNftId: expectedMetaNftId,
        _tags: {},
      },
    });
  });

  // List with single-element _tags array
  it('CORE_020503', async function (): Promise<void> {
    const tags: string[] = ['tag 0'];
    const initPrice = listingPrice;
    const expectedMetaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectedArgs: {
        _nftAddress: testERC721.address,
        _tokenId: tokenId,
        _metaNftId: expectedMetaNftId,
        _tags: { 0: 'tag 0' },
      },
    });
  });

  // List with multi-element _tags array
  it('CORE_020504', async function (): Promise<void> {
    const tags: string[] = ['tag 0', 'tag 1'];
    const initPrice = listingPrice;
    const expectedMetaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectedArgs: {
        _nftAddress: testERC721.address,
        _tokenId: tokenId,
        _metaNftId: expectedMetaNftId,
        _tags: { 0: 'tag 0', 1: 'tag 1' },
      },
    });
  });

  // Re-list a delisted pair
  it('CORE_020505', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const metaNftPrice: BigNumberish = 0;

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(metaNftId, metaNftPrice, deadline),
      name: 'Delist',
    });

    await testERC721.connect(user1).approve(core.address, tokenId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });
  });

  // List with zero _nftAddress
  it('CORE_020506', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(zeroAddr, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // List with invalid _nftAddress
  it('CORE_020507', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(invalidNftAddr, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // List with non-minted _tokenId
  it('CORE_020508', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId + 1, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // List listed NFT
  it('CORE_020509', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;
    const expectedMetaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectedArgs: {
        _nftAddress: testERC721.address,
        _tokenId: tokenId,
        _metaNftId: expectedMetaNftId,
        _tags: {},
      },
    });

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // List with zero _initPrice
  it('CORE_020510', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = 0;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // List with _initPrice above maximum
  it('CORE_020511', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = maxInitPrice.add(1);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // List with zero _baseToken
  it('CORE_020512', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, zeroAddr, tags, dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });
  });

  // TODO: CORE_020513 List with not-allowed _baseToken
});
