import {
  BigNumber,
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
  afterBaseFee,
  afterRoundFee,
  beforeBaseFee,
  beforeRoundFee,
  deadline,
  df10To20,
  df20To30, dummyIpfsHash,
  f10,
  f20,
  getEventArgs, listingPrice,
  microEther,
  oneEther,
  overdueDeadline,
  roundUnit,
  runRWMethod,
  tenPercent,
  twentyPercent,
  zeroEther,
} from '../../testUtils';

describe('sellExactRoundsWithBases', function () {
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

  // Sell when some rounds were minted
  it('CORE_010701', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          beforeRoundFee(tenPercent),
          afterBaseFee(df10To20).sub(microEther),
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Sell with all rounds minted
  it('CORE_010702', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    const baseIn = await aMMFacet.quoteBuyExactRounds(metaNftId, beforeRoundFee(tenPercent));

    await testERC20.connect(user1).approve(core.address, baseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyExactRoundsWithBases(
          metaNftId,
          baseIn,
          beforeRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          beforeRoundFee(tenPercent),
          afterBaseFee(f10).sub(microEther),
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Sell with some rounds possessed
  it('CORE_010703', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df20To30));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df20To30),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          beforeRoundFee(tenPercent),
          afterBaseFee(df20To30).sub(microEther),
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Sell with all rounds possessed
  it('CORE_010704', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    const roundOut1 = beforeRoundFee(tenPercent);
    const baseIn1 = await aMMFacet.quoteBuyExactRounds(metaNftId, roundOut1);

    await testERC20.connect(user1).approve(core.address, baseIn1);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyExactRoundsWithBases(
          metaNftId,
          baseIn1,
          roundOut1,
          deadline,
        ),
      name: 'Swap',
    });

    const roundOut2 = afterRoundFee(twentyPercent.sub(roundOut1));
    const baseIn2 = await aMMFacet.quoteBuyExactRounds(metaNftId, roundOut2);

    await testERC20.connect(user2).approve(core.address, baseIn2);

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          baseIn2,
          roundOut2,
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          beforeRoundFee(tenPercent),
          afterBaseFee(df10To20).sub(microEther),
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Sell with zero _minBaseOut
  it('CORE_010706', async function (): Promise<void> {
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

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          tenPercent,
          zeroEther,
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Sell with non-minted _metaNftId
  it('CORE_010707', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          tenPercent,
          f10.sub(microEther),
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Sell when just listed
  it('CORE_010710', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          tenPercent,
          f10.sub(microEther),
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Sell with zero _roundIn
  it('CORE_010711', async function (): Promise<void> {
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

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          zeroEther,
          f10.sub(microEther),
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Sell with _roundIn less than round unit
  it('CORE_010712', async function (): Promise<void> {
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

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          roundUnit.sub(1),
          f10.sub(microEther),
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Sell with _roundIn more than possessed
  it('CORE_010713', async function (): Promise<void> {
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

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          twentyPercent,
          f20.sub(microEther),
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Sell with _minBaseOut more than _roundIn required
  it('CORE_010714', async function (): Promise<void> {
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

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          tenPercent,
          f20.sub(microEther),
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Sell with overdue _deadline
  it('CORE_010715', async function (): Promise<void> {
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

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .sellExactRoundsWithBases(
          metaNftId,
          tenPercent,
          f10.sub(microEther),
          overdueDeadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });
});
