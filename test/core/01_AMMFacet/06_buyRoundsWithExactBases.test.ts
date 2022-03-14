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
  afterRoundFee,
  beforeBaseFee,
  deadline,
  dummyIpfsHash,
  f10,
  g0Delist,
  getEventArgs, listingPrice,
  oneEther,
  overdueDeadline,
  runRWMethod,
  tenPercent,
  zeroEther,
} from '../../testUtils';

describe('buyRoundsWithExactBases', function () {
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

  // Buy when just listed
  it('CORE_010601', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Buy when some rounds were minted
  it('CORE_010602', async function (): Promise<void> {
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

    const desiredBaseIn: BigNumber = oneEther.mul(10);
    const expectedRoundOut: BigNumber = oneEther.mul(5); // TODO

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Buy with zero _minRoundOut
  it('CORE_010604', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = oneEther.mul(0);
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
    });
  });

  // Buy with non-minted _metaNftId
  it('CORE_010605', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;
    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Buy with non-latest _metaNftId
  it('CORE_010606', async function (): Promise<void> {
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

    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Buy when all versions are delisted
  it('CORE_010607', async function (): Promise<void> {
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

    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Buy with zero _baseIn
  it('CORE_010608', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = oneEther.mul(9);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          zeroEther,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Buy with _baseIn more than approved
  it('CORE_010609', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const desiredBaseIn: BigNumber = oneEther.mul(10);
    const approvedBaseIn: BigNumber = desiredBaseIn.sub(oneEther);

    await testERC20.connect(user1).approve(core.address, approvedBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Buy with _minRoundOut more than _baseIn required
  it('CORE_010610', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = tenPercent;
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          deadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });

  // Buy with overdue _deadline
  it('CORE_010611', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const desiredBaseIn: BigNumber = oneEther.mul(10);

    await testERC20.connect(user1).approve(core.address, desiredBaseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          desiredBaseIn,
          expectedRoundOut,
          overdueDeadline,
        ),
      name: 'Swap',
      expectRevert: true,
    });
  });
});
