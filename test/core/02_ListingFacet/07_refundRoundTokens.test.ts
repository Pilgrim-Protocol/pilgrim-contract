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
  beforeNftFee,
  deadline,
  df10To20,
  dummyIpfsHash,
  f10,
  g0Delist,
  g10Delist,
  g10RHolderPR,
  g20Delist,
  g20RHolderPR,
  getEventArgs, listingPrice,
  microEther,
  oneEther,
  overdueDeadline,
  runRWMethod,
  tenPercent,
} from '../../testUtils';

describe('refundRoundTokens', function () {
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

  // Refund when delisted without rounds minted
  it('CORE_020701', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g0Delist));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g0Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g0Delist),
      },
    });

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectRevert: true,
    });
  });

  // Refund when delisted with some rounds minted
  it('CORE_020702', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g10Delist));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g10Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g10Delist),
      },
    });

    // user2's round shard is 996/1000 (4/1000 for pair owner)
    const expectedRefundAmountOut = g10RHolderPR.mul(1000).mul(996).div(1000);

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectedArgs: {
        _sender: user2Addr,
        _amountIn: afterRoundFee(tenPercent),
        _amountOut: expectedRefundAmountOut,
      },
    });
  });

  // Refund when pair is latest but delisted
  it('CORE_020703', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g10Delist));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g10Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g10Delist),
      },
    });

    // user2's round shard is 996/1000 (4/1000 for pair owner)
    const expectedRefundAmountOut = g10RHolderPR.mul(1000).mul(996).div(1000).sub(microEther);

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectedArgs: {
        _sender: user2Addr,
        _amountIn: afterRoundFee(tenPercent),
        _amountOut: expectedRefundAmountOut,
      },
    });
  });

  // Refund when pair is not latest and delisted
  it('CORE_020704', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g10Delist));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g10Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g10Delist),
      },
    });

    await testERC721.connect(user1).approve(core.address, tokenId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    // user2's round shard is 996/1000 (4/1000 for pair owner)
    const expectedRefundAmountOut = g10RHolderPR.mul(1000).mul(996).div(1000).sub(microEther);

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectedArgs: {
        _sender: user2Addr,
        _amountIn: afterRoundFee(tenPercent),
        _amountOut: expectedRefundAmountOut,
      },
    });
  });

  // Refund with all rounds minted
  it('CORE_020705', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g10Delist));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g10Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g10Delist),
      },
    });

    // user2's round shard is 996/1000 (4/1000 for pair owner)
    const expectedRefundAmountOut = g10RHolderPR.mul(1000).mul(996).div(1000).sub(microEther);

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectedArgs: {
        _sender: user2Addr,
        _amountIn: afterRoundFee(tenPercent),
        _amountOut: expectedRefundAmountOut,
      },
    });
  });

  // Refund with some rounds minted
  it('CORE_020706', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user3).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user3)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g20Delist));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g20Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g20Delist),
      },
    });

    // user2's round shard is 996/2000 (8/2000 for pair owner)
    const expectedRefundAmountOut: BigNumber = g20RHolderPR.mul(1000).mul(996).div(1000);

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectedArgs: {
        _sender: user2Addr,
        _amountIn: afterRoundFee(tenPercent),
        _amountOut: expectedRefundAmountOut,
      },
    });

    await runRWMethod({
      method: listingFacet.connect(user3).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectedArgs: {
        _sender: user3Addr,
        _amountIn: afterRoundFee(tenPercent),
        _amountOut: expectedRefundAmountOut,
      },
    });
  });

  // Refund with non-minted _metaNftId
  it('CORE_020707', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet.connect(user1).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectRevert: true,
    });
  });

  // Refund with listed _metaNftId
  it('CORE_020708', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        deadline,
      ),
      name: 'Refund',
      expectRevert: true,
    });
  });

  // Refund with overdue _deadline
  it('CORE_020709', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g10Delist));

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g10Delist),
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: beforeNftFee(g10Delist),
      },
    });

    await runRWMethod({
      method: listingFacet.connect(user2).refundRoundTokens(
        metaNftId,
        overdueDeadline,
      ),
      name: 'Refund',
      expectRevert: true,
    });
  });
});
