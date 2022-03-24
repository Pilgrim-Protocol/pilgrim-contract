import { expect } from 'chai';
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
  PilgrimMetaNFT, PilgrimToken,
} from '../../../typechain';
import {
  afterRoundFee,
  beforeBaseFee,
  beforeNftFee,
  deadline,
  defaultBidTimeOut,
  dummyIpfsHash,
  emptyTagArr,
  f10,
  g0Delist,
  g0MetaNFT,
  g0NFT,
  g10MetaNFT,
  getApproxTimeOut,
  getEventArgs, listingPrice,
  minBidTimeOut,
  oneEther,
  overdueDeadline,
  runRWMethod,
  sleep,
  tenPercent,
} from '../../testUtils';

describe('bidMetaNFT', function () {
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
  let pilgrim: PilgrimToken;

  let aMMFacet: AMMFacet;
  let listingFacet: ListingFacet;
  // let viewFacet: ViewFacet;
  let managingFacet: ManagingFacet;

  this.beforeEach(async function () {
    // @ts-ignore
    ({ core, pilgrimMetaNFT, testERC20, pilgrim } = await deployAll());

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

  it('CORE_TEMP_04', async function (): Promise<void> {
    await managingFacet.createPool(pilgrim.address, 1, 0);

    const listReulst = await runRWMethod({
      method: listingFacet.connect(user1).list(
        testERC721.address,
        tokenId,
        listingPrice,
        pilgrim.address,
        emptyTagArr,
        dummyIpfsHash,
      ),
      name: 'List',
    });

    const metaNftId: BigNumberish = listReulst._metaNftId;

    const method = listingFacet.connect(user2).bidMetaNft(
      metaNftId,
      beforeNftFee(g0MetaNFT),
      deadline,
    );
    await expect(method).to.be.revertedWith('PIL trading is temporary disabled');
  });

  // Bid when just listed
  it('CORE_021101', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    const bidResult = await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectedArgs: {
        _metaNftId: metaNftId,
        _sender: user2Addr,
        _amountIn: beforeNftFee(g0MetaNFT),
      },
    });

    const approxTimeOut: number = await getApproxTimeOut(listingFacet, defaultBidTimeOut);
    expect(bidResult._expiry).to.be.within(approxTimeOut - 60, approxTimeOut + 60);
  });

  // Bid when some rounds were minted
  it('CORE_021102', async function (): Promise<void> {
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
      method: aMMFacet.connect(user2).buyExactRoundsWithBases(
        metaNftId,
        beforeBaseFee(f10),
        afterRoundFee(tenPercent),
        deadline,
      ),
      name: 'Swap',
    });

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g10MetaNFT));

    const bidResult = await runRWMethod({
      method: listingFacet.connect(user3).bidMetaNft(
        metaNftId,
        beforeNftFee(g10MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectedArgs: {
        _metaNftId: metaNftId,
        _sender: user3Addr,
        _amountIn: beforeNftFee(g10MetaNFT),
      },
    });

    const approxTimeOut: number = await getApproxTimeOut(listingFacet, defaultBidTimeOut);
    expect(bidResult._expiry).to.be.within(approxTimeOut - 60, approxTimeOut + 60);
  });

  // Re-bid when caller's bid expired and unbidded
  it('CORE_021103', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await runRWMethod({
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
    });

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    const bidResult = await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectedArgs: {
        _metaNftId: metaNftId,
        _sender: user2Addr,
        _amountIn: beforeNftFee(g0MetaNFT),
      },
    });

    const approxTimeOut: number = await getApproxTimeOut(listingFacet, minBidTimeOut);
    expect(bidResult._expiry).to.be.within(approxTimeOut - 60, approxTimeOut + 60);
  });

  // Call by owner
  it('CORE_021104', async function (): Promise<void> {
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

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user1).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Bid with non-minted _metaNftId
  it('CORE_021105', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user1).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Bid with non-latest _metaNftId
  it('CORE_021106', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, g0NFT);

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Bid when all versions are delisted
  it('CORE_021107', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Bid with _amountIn less than required
  it('CORE_021108', async function (): Promise<void> {
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
      method: aMMFacet.connect(user2).buyExactRoundsWithBases(
        metaNftId,
        beforeBaseFee(f10),
        afterRoundFee(tenPercent),
        deadline,
      ),
      name: 'Swap',
    });

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Bid with _amountIN more than required but approved
  it('CORE_021109', async function (): Promise<void> {
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
      method: aMMFacet.connect(user2).buyExactRoundsWithBases(
        metaNftId,
        beforeBaseFee(f10),
        afterRoundFee(tenPercent),
        deadline,
      ),
      name: 'Swap',
    });

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidMetaNft(
        metaNftId,
        g10MetaNFT,
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Bid with overdue deadline
  it('CORE_021110', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        overdueDeadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Re-bid when caller bidded but yet expired --> cannot unbid
  it('CORE_021111', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });

  // Re-bid when caller's bid expired but yet unbidded
  it('CORE_021112', async function (): Promise<void> {
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

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
    });

    await testERC20.connect(user2).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user2).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
      expectRevert: true,
    });
  });
});
