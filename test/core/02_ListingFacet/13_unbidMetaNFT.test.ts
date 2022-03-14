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
  beforeNftFee,
  deadline,
  dummyIpfsHash,
  emptyTagArr,
  g0Delist,
  g0MetaNFT,
  getEventArgs, listingPrice,
  minBidTimeOut,
  oneEther,
  overdueDeadline,
  runRWMethod,
  sleep,
} from '../../testUtils';

describe('unbidMetaNFT', function () {
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

  // Unbid when expired
  it('CORE_021301', async function (): Promise<void> {
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
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });
  });

  // Unbid when pair is latest but delisted
  it('CORE_021302', async function (): Promise<void> {
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
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });
  });

  // Unbid when pair is not latest and delisted
  it('CORE_021303', async function (): Promise<void> {
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
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });
  });

  // Call by owner who bidded previously before becoming owner
  it('CORE_021304', async function (): Promise<void> {
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

    await pilgrimMetaNFT.connect(user1)['safeTransferFrom(address,address,uint256)'](user1Addr, user2Addr, metaNftId);

    await sleep((minBidTimeOut + 1) * 1000);

    await runRWMethod({
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });
  });

  // Unbid when BidderQueue dequeued by others
  it('CORE_021305', async function (): Promise<void> {
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

    await testERC20.connect(user3).approve(core.address, beforeNftFee(g0MetaNFT));

    await runRWMethod({
      method: listingFacet.connect(user3).bidMetaNft(
        metaNftId,
        beforeNftFee(g0MetaNFT),
        deadline,
      ),
      name: 'Bid',
    });

    await sleep((minBidTimeOut + 1) * 1000);

    await runRWMethod({
      method: listingFacet.connect(user3).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });

    await runRWMethod({
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });
  });

  // Unbid with non-minted _metaNftId
  it('CORE_021306', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await runRWMethod({
      method: listingFacet.connect(user1).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectRevert: true,
    });
  });

  // Unbid when listed and yet expired
  it('CORE_021307', async function (): Promise<void> {
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

    await runRWMethod({
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectRevert: true,
    });
  });

  // Unbid with overdue _deadline
  it('CORE_021308', async function (): Promise<void> {
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
        overdueDeadline,
      ),
      name: 'Unbid',
      expectRevert: true,
    });
  });

  // Re-unbid when just unbidded
  it('CORE_021309', async function (): Promise<void> {
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
      expectedArgs: {
        _amountOut: beforeNftFee(g0MetaNFT),
      },
    });

    await runRWMethod({
      method: listingFacet.connect(user2).unbidMetaNft(
        metaNftId,
        deadline,
      ),
      name: 'Unbid',
      expectRevert: true,
    });
  });
});
