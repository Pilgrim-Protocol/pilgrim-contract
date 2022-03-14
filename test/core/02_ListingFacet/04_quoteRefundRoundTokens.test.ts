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
  dummyIpfsHash,
  f10,
  g0Delist,
  g0RHolderPR,
  g10Delist,
  g10RHolderPR,
  getEventArgs, listingPrice,
  microEther,
  oneEther,
  runROMethod,
  runRWMethod,
  tenPercent,
} from '../../testUtils';

describe('quoteRefundRoundTokens', function () {
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

  // Quote when delisted without rounds minted
  it('CORE_020401', async function (): Promise<void> {
    const tags: string[] = [];

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g0Delist));

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(metaNftId, beforeNftFee(g0Delist), deadline),
      name: 'Delist',
    });

    await runROMethod({
      method: listingFacet.connect(user2).functions.quoteRefundRoundTokens(metaNftId),
      expectedArgs: {
        _price: g0RHolderPR,
      },
    });
  });

  // Quote when delisted with some rounds minted
  it('CORE_020402', async function (): Promise<void> {
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

    await testERC20.connect(user1).approve(core.address, beforeNftFee(g10Delist).add(microEther));

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        beforeNftFee(g10Delist).add(microEther),
        deadline,
      ),
      name: 'Delist',
    });

    await runROMethod({
      method: listingFacet.connect(user1).functions.quoteRefundRoundTokens(metaNftId),
      expectedArgs: {
        _price: g10RHolderPR,
      },
    });
  });

  // Quote pair that is latest but delisted
  it('CORE_020403', async function (): Promise<void> {
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

    const secondListResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const secondMetaNftId: BigNumberish = secondListResult._metaNftId;

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, secondMetaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(secondMetaNftId, metaNftPrice, deadline),
      name: 'Delist',
    });

    await runROMethod({
      method: listingFacet.connect(user2).functions.quoteRefundRoundTokens(secondMetaNftId),
      expectedArgs: {
        _price: g0RHolderPR,
      },
    });
  });

  // Quote pair that is not latest and delisted
  it('CORE_020404', async function (): Promise<void> {
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

    const secondListResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const secondMetaNftId: BigNumberish = secondListResult._metaNftId;

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, secondMetaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(secondMetaNftId, metaNftPrice, deadline),
      name: 'Delist',
    });

    await runROMethod({
      method: listingFacet.connect(user2).functions.quoteRefundRoundTokens(metaNftId),
      expectedArgs: {
        _price: g0RHolderPR,
      },
    });
  });

  // Quote when listed
  it('CORE_020405', async function (): Promise<void> {
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
      method: listingFacet.connect(user2).functions.quoteRefundRoundTokens(metaNftId),
      expectRevert: true,
    });
  });

  // Quote with non-minted _metaNftId
  it('CORE_020406', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;

    await runROMethod({
      method: listingFacet.connect(user2).functions.quoteRefundRoundTokens(metaNftId),
      expectRevert: true,
    });
  });
});
