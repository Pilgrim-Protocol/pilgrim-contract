import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { deployAll } from '../../scripts/deploy/index';
import {
  CoreExploitMock,
  CoreExploitMock2,
  Diamond,
  ERC20Mock,
  ERC721Mock,
  ListingFacet,
  ManagingFacet,
} from '../../typechain';
import { dummyIpfsHash, listingPrice, mintNft, oneEther, runRWMethod } from '../testUtils';

describe('Modifiers', function () {
  let core: Diamond;
  let listingFacet: ListingFacet;
  let managingFacet: ManagingFacet;

  let testERC20: ERC20Mock;
  let erc721: ERC721Mock;

  let coreExploitMock: CoreExploitMock;
  let coreExploitMock2: CoreExploitMock2;

  let user: Signer;

  this.beforeEach(async function () {
    // @ts-ignore
    ({ core, testERC20 } = await deployAll());

    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);

    erc721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestNFT', 'TNFT');

    coreExploitMock = await (await ethers.getContractFactory('CoreExploitMock')).deploy(core.address, testERC20.address);
    coreExploitMock2 = await (await ethers.getContractFactory('CoreExploitMock2')).deploy(
      core.address,
      testERC20.address,
      coreExploitMock.address,
    );

    await managingFacet.createPool(testERC20.address, 1, 0);

    [, user] = await ethers.getSigners();
  });

  // Function call from same msg.sender
  it('CORE_060101', async function (): Promise<void> {
    const tokenId = await mintNft(erc721, user);
    await erc721.connect(user).approve(core.address, tokenId);
    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user)
        .list(erc721.address, tokenId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;

    await testERC20.transfer(coreExploitMock.address, oneEther.mul(1000));
    await expect(coreExploitMock.buyTwice(metaNftId, oneEther)).to.be.revertedWith('Pilgrim: one block, one function');
  });

  // Function call from same tx.origin
  it('CORE_060102', async function (): Promise<void> {
    const tokenId = await mintNft(erc721, user);
    await erc721.connect(user).approve(core.address, tokenId);
    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user)
        .list(erc721.address, tokenId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;

    await testERC20.transfer(coreExploitMock.address, oneEther.mul(1000));
    await testERC20.transfer(coreExploitMock2.address, oneEther.mul(1000));
    await expect(coreExploitMock2.buyViaContract(metaNftId, oneEther)).to.be.revertedWith('Pilgrim: one block, one function');
  });
});
