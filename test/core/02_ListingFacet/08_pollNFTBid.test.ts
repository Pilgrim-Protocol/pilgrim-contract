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
  beforeNftFee,
  beforeRoundFee,
  deadline,
  df10To20,
  df10To30,
  df20To30,
  dummyIpfsHash,
  emptyTagArr,
  f10,
  g0Delist,
  g0NFT,
  g10NFT,
  g20NFT,
  g30NFT,
  getEventArgs, listingPrice,
  microEther,
  minBidTimeOut,
  oneEther,
  runROMethod,
  runRWMethod,
  sleep,
  tenPercent,
  twentyPercent,
  zeroAddr,
} from '../../testUtils';

describe('pollNFTBid', function () {
  let admin: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  let user4: Signer;
  let user5: Signer;
  let user6: Signer;
  // let adminAddr: string;
  let user1Addr: string;
  let user2Addr: string;
  let user3Addr: string;
  let user4Addr: string;
  let user5Addr: string;
  let user6Addr: string;

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

    [admin, user1, user2, user3, user4, user5, user6] = await ethers.getSigners();

    // adminAddr = await admin.getAddress();
    user1Addr = await user1.getAddress();
    user2Addr = await user2.getAddress();
    user3Addr = await user3.getAddress();
    user4Addr = await user4.getAddress();
    user5Addr = await user5.getAddress();
    user6Addr = await user6.getAddress();

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
    await testERC20.connect(admin).transfer(user6Addr, oneEther.mul(100_000));
    await managingFacet.createPool(testERC20.address, 1, 0);
  });

  // Poll when just listed
  it('CORE_020801', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await runROMethod({
      method: listingFacet.connect(user2).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when some rounds were minted
  it('CORE_020802', async function (): Promise<void> {
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

    await runROMethod({
      method: listingFacet.connect(user3).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when no rounds minted but one bidded
  it('CORE_020803', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0NFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidNft(
        metaNftId,
        beforeNftFee(g0NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runROMethod({
      method: listingFacet.connect(user3).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user2Addr,
        _amountIn: beforeNftFee(g0NFT),
      },
    });
  });

  // Poll when no rounds minted but some bidded
  it('CORE_020804', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

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

    await runROMethod({
      method: listingFacet.connect(user4).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user2Addr,
        _amountIn: beforeNftFee(g0NFT),
      },
    });
  });

  // Poll when one bidded
  it('CORE_020805', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await runROMethod({
      method: listingFacet.connect(user4).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user3Addr,
        _amountIn: beforeNftFee(g10NFT),
      },
    });
  });

  // Poll when one bidded and expired
  it('CORE_020806', async function (): Promise<void> {
    await managingFacet.setBidTimeout(minBidTimeOut);

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, emptyTagArr, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    await testERC20.connect(user2).approve(core.address, beforeBaseFee(f10));

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    // Testnet doesn't progress its block timestamp for calling read-only functions.
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

    await runROMethod({
      method: listingFacet.connect(user4).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when one bidded and price went above
  it('CORE_020807', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user4).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when one bidded and price went above and back
  it('CORE_020808', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user2).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user4).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user3Addr,
        _amountIn: beforeNftFee(g10NFT),
      },
    });
  });

  // Poll when all expired
  it('CORE_020809', async function (): Promise<void> {
    await managingFacet.setBidTimeout(minBidTimeOut);

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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g10NFT));

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
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    // Testnet doesn't progress its block timestamp for calling read-only functions.
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

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when price went above for all
  it('CORE_020810', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g10NFT));

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
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when price went above and back for all
  it('CORE_020811', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g10NFT));

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
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runRWMethod({
      method: aMMFacet.connect(user2).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user3Addr,
        _amountIn: beforeNftFee(g10NFT),
      },
    });
  });

  // Poll when price went above for all and back for some
  it('CORE_020812', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

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

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To30));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To30),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });

    await runRWMethod({
      method: aMMFacet.connect(user2).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df20To30).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user4Addr,
        _amountIn: beforeNftFee(g20NFT),
      },
    });
  });

  // Poll when some expired
  it('CORE_020813', async function (): Promise<void> {
    await managingFacet.setBidTimeout(2 * minBidTimeOut);

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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g10NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep(minBidTimeOut * 1000);

    await runRWMethod({
      method: listingFacet.connect(user4).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    // Testnet doesn't progress its block timestamp for calling read-only functions.
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

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user4Addr,
        _amountIn: beforeNftFee(g10NFT),
      },
    });
  });

  // Poll when price went above for some
  it('CORE_020814', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

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

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user4Addr,
        _amountIn: beforeNftFee(g20NFT),
      },
    });
  });

  // Poll when price went above and back for some
  it('CORE_020815', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

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

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To20));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To20),
          afterRoundFee(tenPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user4Addr,
        _amountIn: beforeNftFee(g20NFT),
      },
    });

    await runRWMethod({
      method: aMMFacet.connect(user2).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df10To20).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user3Addr,
        _amountIn: beforeNftFee(g10NFT),
      },
    });
  });

  // Poll when price went above for some and some of them went back
  it('CORE_020816', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

    await testERC20.connect(user5).approve(core.address, beforeNftFee(g30NFT));

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

    await runRWMethod({
      method: listingFacet.connect(user5).bidNft(
        metaNftId,
        beforeNftFee(g30NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To30));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To30),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user6).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user5Addr,
        _amountIn: beforeNftFee(g30NFT),
      },
    });

    await runRWMethod({
      method: aMMFacet.connect(user2).sellExactRoundsWithBases(
        metaNftId,
        beforeRoundFee(tenPercent),
        afterBaseFee(df20To30).sub(microEther),
        deadline,
      ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user4Addr,
        _amountIn: beforeNftFee(g20NFT),
      },
    });
  });

  // Poll when either expired or price went above for all
  it('CORE_020817', async function (): Promise<void> {
    await managingFacet.setBidTimeout(2 * minBidTimeOut);

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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep(minBidTimeOut * 1000);

    await runRWMethod({
      method: listingFacet.connect(user4).bidNft(
        metaNftId,
        beforeNftFee(g20NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To30));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To30),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user5).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: zeroAddr,
        _amountIn: 0,
      },
    });
  });

  // Poll when some expired and price went above for some but some still valid
  it('CORE_020818', async function (): Promise<void> {
    await managingFacet.setBidTimeout(2 * minBidTimeOut);

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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10NFT));

    await testERC20.connect(user4).approve(core.address, beforeNftFee(g20NFT));

    await testERC20.connect(user5).approve(core.address, beforeNftFee(g30NFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidNft(
        metaNftId,
        beforeNftFee(g10NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep(minBidTimeOut * 1000);

    await runRWMethod({
      method: listingFacet.connect(user4).bidNft(
        metaNftId,
        beforeNftFee(g20NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await runRWMethod({
      method: listingFacet.connect(user5).bidNft(
        metaNftId,
        beforeNftFee(g30NFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeBaseFee(df10To30));

    await runRWMethod({
      method: aMMFacet
        .connect(user2)
        .buyExactRoundsWithBases(
          metaNftId,
          beforeBaseFee(df10To30),
          afterRoundFee(twentyPercent),
          deadline,
        ),
      name: 'Swap',
    });

    await runROMethod({
      method: listingFacet.connect(user6).functions.pollNftBid(
        metaNftId,
      ),
      expectedArgs: {
        _bidder: user5Addr,
        _amountIn: beforeNftFee(g30NFT),
      },
    });
  });

  // Poll with non-minted _metaNftId
  it('CORE_020819', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await runROMethod({
      method: listingFacet.connect(user1).functions.pollNftBid(
        metaNftId,
      ),
      expectRevert: true,
    });
  });

  // Poll with non-latest _metaNftId
  it('CORE_020820', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        oneEther,
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
        oneEther,
        testERC20.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    await runROMethod({
      method: listingFacet.connect(user2).functions.pollNftBid(
        metaNftId,
      ),
      expectRevert: true,
    });
  });

  // Poll when all versions are delisted
  it('CORE_020821', async function (): Promise<void> {
    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        oneEther,
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

    await runROMethod({
      method: listingFacet.connect(user2).functions.pollNftBid(
        metaNftId,
      ),
      expectRevert: true,
    });
  });
});
