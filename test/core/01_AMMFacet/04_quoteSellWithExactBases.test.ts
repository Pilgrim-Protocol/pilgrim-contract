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
  afterRoundFee,
  beforeBaseFee,
  beforeNftFee,
  deadline,
  dummyIpfsHash,
  f10,
  f20,
  g0Delist,
  g10Delist,
  getEventArgs, listingPrice,
  microEther,
  oneEther,
  runROMethod,
  runRWMethod,
  tenPercent,
  zeroEther,
} from '../../testUtils';

describe('quoteSellWithExactBases', function () {
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

  // Quote when some rounds were minted
  it('CORE_010401', async function (): Promise<void> {
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
        .functions.quoteSellWithExactBases(metaNftId, afterBaseFee(f10).sub(microEther)),
    });
  });

  // Quote with all bases reserved
  it('TODO CORE_010402', async function (): Promise<void> {
    /* const tags: string[] = [];
    const initPrice = listingPrice;

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, initPrice, testERC20.address, tags, dummyIpfsHash),
      name: "List",
    });

    const metaNftId: BigNumberish = listResult._metaNftId;
    const expectedRoundOut: BigNumber = oneEther.mul(9); // TODO
    const baseIn: BigNumber = microEther.mul(10);

    await testERC20.connect(user1).approve(core.address, baseIn);

    await runRWMethod({
      method: aMMFacet
        .connect(user1)
        .buyRoundsWithExactBases(
          metaNftId,
          baseIn,
          expectedRoundOut,
          user1Addr,
          deadline
        ),
      name: "Swap",
    });

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteSellWithExactBases(metaNftId, baseIn),
    }); */
  });

  // Quote with non-minted _metaNftId
  it('CORE_010403', async function (): Promise<void> {
    const metaNftId = 0;

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteSellWithExactBases(metaNftId, tenPercent),
      expectRevert: true,
    });
  });

  // Quote with non-latest _metaNftId
  it('CORE_010404', async function (): Promise<void> {
    const tags: string[] = [];

    let listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
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
      method: listingFacet
        .connect(user1)
        .delist(metaNftId, beforeNftFee(g10Delist).add(microEther), deadline),
      name: 'Delist',
    });

    await testERC721.connect(user1).approve(core.address, tokenId);

    listResult = await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, tags, dummyIpfsHash),
      name: 'List',
    });

    await runROMethod({
      method: aMMFacet
        .connect(user1)
        .functions.quoteSellWithExactBases(metaNftId, tenPercent),
      expectRevert: true,
    });
  });

  // Quote when all versions are delisted
  it('CORE_010405', async function (): Promise<void> {
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
      method: aMMFacet
        .connect(user1)
        .functions.quoteSellWithExactBases(metaNftId, tenPercent),
      expectRevert: true,
    });
  });

  // Quote with zero _baseOut
  it('CORE_010406', async function (): Promise<void> {
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
        .functions.quoteSellWithExactBases(metaNftId, zeroEther),
      expectRevert: true,
    });
  });

  // Quote with more _baseOut than base reserved
  it('CORE_010407', async function (): Promise<void> {
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
        .functions.quoteSellWithExactBases(metaNftId, f20),
      expectRevert: true,
    });
  });
});
