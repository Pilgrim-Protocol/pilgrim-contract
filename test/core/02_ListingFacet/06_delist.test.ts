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
  getEventArgs, listingPrice,
  microEther,
  oneEther,
  overdueDeadline,
  runRWMethod,
  tenPercent,
} from '../../testUtils';

describe('delist', function () {
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

  // Delist when just listed
  it('CORE_020601', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedAmountIn: BigNumber = oneEther.mul(0);

    await testERC20.connect(user1).approve(core.address, expectedAmountIn);
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        expectedAmountIn,
        deadline,
      ),
      name: 'Delist',
      expectedArgs: {
        _amountIn: expectedAmountIn,
      },
    });
  });

  // Delist when some rounds were minted
  it('CORE_020602', async function (): Promise<void> {
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

    // const expectedAmountIn: BigNumber = oneEther.mul(100);

    await testERC20.connect(user1).approve(core.address, oneEther.mul(500));
    await pilgrimMetaNFT.connect(user1).approve(core.address, metaNftId);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        oneEther.mul(500),
        deadline,
      ),
      name: 'Delist',
      /* expectedArgs: {
        _amountIn: expectedAmountIn
      } */
    });
  });

  // Call by non-owner
  it('CORE_020604', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedAmountIn: BigNumber = oneEther.mul(100);

    await testERC20.connect(user2).approve(core.address, expectedAmountIn);

    await runRWMethod({
      method: listingFacet.connect(user2).delist(
        metaNftId,
        expectedAmountIn,
        deadline,
      ),
      name: 'Delist',
      expectRevert: true,
    });
  });

  // Delist with non-minted _metaNftId
  it('CORE_020605', async function (): Promise<void> {
    const metaNftId: BigNumberish = 0;
    const expectedAmountIn: BigNumber = oneEther.mul(100);

    await testERC20.connect(user1).approve(core.address, expectedAmountIn);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        expectedAmountIn,
        deadline,
      ),
      name: 'Delist',
      expectRevert: true,
    });
  });

  // Delist with non-latest _metaNftId
  it('CORE_020606', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const metaNftPrice = oneEther.mul(100);

    await testERC20.connect(user1).approve(core.address, metaNftPrice);

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

    await testERC20.connect(user1).approve(core.address, metaNftPrice);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        metaNftPrice,
        deadline,
      ),
      name: 'buy',
      expectRevert: true,
    });
  });

  // Delist when all versions are delisted
  it('CORE_020607', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const metaNftPrice = oneEther.mul(10_000);

    await testERC20.connect(user1).approve(core.address, metaNftPrice);

    await pilgrimMetaNFT.connect(user1).approve(listingFacet.address, metaNftId);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .delist(metaNftId, metaNftPrice, deadline),
      name: 'Delist',
    });

    await testERC20.connect(user1).approve(core.address, metaNftPrice);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        metaNftPrice,
        deadline,
      ),
      name: 'buy',
      expectRevert: true,
    });
  });

  // TODO
  // Delist with _maxAmountIn less than required
  it.skip('CORE_020608', async function (): Promise<void> {
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

    const expectedAmountIn: BigNumber = (await listingFacet.connect(user1).quoteDelist(metaNftId)).sub(microEther);

    await testERC20.connect(user1).approve(core.address, expectedAmountIn);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        expectedAmountIn,
        deadline,
      ),
      name: 'Delist',
      expectRevert: true,
    });
  });

  // TODO
  // Delist with _maxAmountIn more than required but approved
  it.skip('CORE_020609', async function (): Promise<void> {
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

    const expectedAmountIn: BigNumber = await listingFacet.connect(user1).quoteDelist(metaNftId);
    const approvedAmountIn: BigNumber = expectedAmountIn.sub(microEther);

    await testERC20.connect(user1).approve(core.address, approvedAmountIn);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        expectedAmountIn,
        deadline,
      ),
      name: 'Delist',
      expectRevert: true,
    });
  });

  // Delist with overdue _deadline
  it('CORE_020610', async function (): Promise<void> {
    const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedAmountIn: BigNumber = oneEther.mul(100);

    await testERC20.connect(user1).approve(core.address, expectedAmountIn);

    await runRWMethod({
      method: listingFacet.connect(user1).delist(
        metaNftId,
        expectedAmountIn,
        overdueDeadline,
      ),
      name: 'Delist',
      expectRevert: true,
    });
  });
});
