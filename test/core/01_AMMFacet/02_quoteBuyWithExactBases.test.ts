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
  afterRoundFee,
  beforeBaseFee,
  deadline,
  dummyIpfsHash,
  f10,
  g0Delist,
  getEventArgs, listingPrice,
  oneEther,
  runROMethod,
  runRWMethod,
  tenPercent,
  zeroEther,
} from '../../testUtils';

describe('quoteBuyWithExactBases', function () {
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

  // Quote when just listed
  it('CORE_010201', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteBuyWithExactBases(metaNftId, tenPercent),
    });
  });

  // Quote when some rounds were minted
  it('CORE_010202', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteBuyWithExactBases(metaNftId, tenPercent),
    });
  });

  // Quote with non-minted _metaNftId
  it('CORE_010203', async function (): Promise<void> {
    const metaNftId = 0;
    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteBuyWithExactBases(metaNftId, tenPercent),
      expectRevert: true,
    });
  });

  // Quote with non-latest _metaNftId
  it('CORE_010204', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, g0Delist);

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(metaNftId, g0Delist, deadline),
      name: 'Delist',
    });

    await testERC721.connect(user1).approve(core.address, tokenId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteBuyWithExactBases(metaNftId, tenPercent),
      expectRevert: true,
    });
  });

  // Quote when all versions are delisted
  it('CORE_010205', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, g0Delist);

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(metaNftId, g0Delist, deadline),
      name: 'Delist',
    });

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteBuyWithExactBases(metaNftId, tenPercent),
      expectRevert: true,
    });
  });

  // Quote with zero _baseIn
  it('CORE_010206', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteBuyWithExactBases(metaNftId, zeroEther),
      expectRevert: true,
    });
  });
});
