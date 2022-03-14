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
  afterBaseFee,
  afterNftFee,
  afterRoundFee,
  beforeBaseFee,
  beforeNftFee,
  beforeRoundFee,
  deadline,
  df10To20,
  df20To30,
  dummyIpfsHash,
  emptyTagArr,
  f10,
  f20,
  f30,
  g0Delist,
  g0MetaNFT,
  g0NFT,
  g0RHolderPR,
  g10MetaNFT,
  g10NFT,
  g10RHolderPR,
  g20NFT,
  getEventArgs, listingPrice,
  microEther,
  minBidTimeOut,
  oneEther,
  overdueDeadline,
  runRWMethod,
  sleep,
  tenPercent,
  thirtyPercent,
  twentyPercent,
} from '../../testUtils';

describe('acceptNFTBid', function () {
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

  // Accept when no rounds minted but one bidded
  it('CORE_021401', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g0MetaNFT.sub(microEther),
        _amountToRHolderPR: g0RHolderPR,
      },
    });
  });

  // Accept when no rounds minted but some bidded
  it('CORE_021402', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g0MetaNFT.sub(microEther),
        _amountToRHolderPR: g0RHolderPR,
      },
    });
  });

  // Accept when one bidded
  it('CORE_021403', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when one bidded and price went above and back
  it('CORE_021404', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user3).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user3)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user3).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when price went above and back for all
  it('CORE_021405', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user4).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user4)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user4).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when price went above for all and back for some
  it('CORE_021406', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user4).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user4)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user4).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when some expired
  it('CORE_021407', async function (): Promise<void> {
    await managingFacet.setBidTimeout(2 * minBidTimeOut);

    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep(2 * minBidTimeOut * 1000);

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g0MetaNFT.sub(microEther),
        _amountToRHolderPR: g0RHolderPR,
      },
    });
  });

  // Accept when price went above for some
  it('CORE_021408', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user4).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user4)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when price went above and back for some
  it('CORE_021409', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g20NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g20NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user4).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user4)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user4).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when price went above for some and some of them went back
  it('CORE_021410', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user4).bidNft(
        metaNftId,
        beforeNftFee(g20NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user5).approve(core.address, beforeBaseFee(f20));

    await runRWMethod({
      method: aMMFacet
        .connect(user5)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f20),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user5).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept when some expired and price went above for some but some still valid
  it('CORE_021411', async function (): Promise<void> {
    await managingFacet.setBidTimeout(4 * minBidTimeOut);

    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g20NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g20NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((4 * minBidTimeOut + 1) * 1000);

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user4).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user5).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user5)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g10MetaNFT.sub(microEther),
        _amountToRHolderPR: g10RHolderPR,
      },
    });
  });

  // Accept with zero _minAmountOut
  it('CORE_021412', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        0,
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g0MetaNFT.sub(microEther),
        _amountToRHolderPR: g0RHolderPR,
      },
    });
  });

  // Call by non-owner
  it('CORE_021413', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user3).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when just listed
  it('CORE_021414', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when some rounds minted but no one bidded
  it('CORE_021415', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

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

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when one bidded and expired
  it('CORE_021416', async function (): Promise<void> {
    await managingFacet.setBidTimeout(minBidTimeOut);

    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when one bidded and price went above
  it('CORE_021417', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user3).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user3)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when all expired
  it('CORE_021418', async function (): Promise<void> {
    await managingFacet.setBidTimeout(minBidTimeOut);

    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when price went above for all
  it('CORE_021419', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user4).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user4)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when either expired or price went above for all
  it('CORE_021420', async function (): Promise<void> {
    await managingFacet.setBidTimeout(minBidTimeOut);

    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user4).approve(core.address, beforeBaseFee(f10));

    await runRWMethod({
      method: aMMFacet
        .connect(user4)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(f10),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept with non-minted _metaNftId
  it('CORE_021421', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept with non-latest _metaNftId
  it('CORE_021422', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user1).approve(core.address, g0Delist);
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        g0Delist,
        deadline,
      ),
      name: 'Delist',
    });

    await testERC721.connect(user1).approve(core.address, tokenId);

    await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when all versions are delisted
  it('CORE_021423', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user1).approve(core.address, g0Delist);
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        g0Delist,
        deadline,
      ),
      name: 'Delist',
    });

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when _minAmountOut more than _amountOut
  it('CORE_021424', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g10MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Accept when overdue _deadline
  it('CORE_021425', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        overdueDeadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });

  // Re-accept when accepted
  it('CORE_021426', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectedArgs: {
        _amountOut: g0MetaNFT.sub(microEther),
        _amountToRHolderPR: g0RHolderPR,
      },
    });

    await runRWMethod({
      method: listingFacet.connect(user1).acceptNftBid(
        metaNftId,
        g0MetaNFT.sub(microEther),
        deadline,
      ),
      name: 'Accept',
      expectRevert: true,
    });
  });
});
