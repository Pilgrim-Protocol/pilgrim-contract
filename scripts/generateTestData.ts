import fs from 'fs';

import { ethers } from 'hardhat';

import {
  afterRoundFee,
  deadline,
  dummyIpfsHash,
  mintNft,
  oneEther,
  runRWMethod,
} from '../test/testUtils';
import {
  AMMFacet,
  ListingFacet,
  ManagingFacet,
  ERC721Mock,
} from '../typechain';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min))) + Math.ceil(min);
}

async function main() {
  const coreAddr = JSON.parse(fs.readFileSync('./deployment/Core.json', 'utf8')).address;
  const pilAddr = JSON.parse(fs.readFileSync('./deployment/PilgrimToken.json', 'utf8')).address;

  const ammFacet = await ethers.getContractAt('AMMFacet', coreAddr);
  const listingFacet = await ethers.getContractAt('ListingFacet', coreAddr);
  const managingFacet = await ethers.getContractAt('ManagingFacet', coreAddr);

  const pil = await ethers.getContractAt('PilgrimToken', pilAddr);

  const users = await ethers.getSigners();
  const userAddrs = await Promise.all(users.map(u => u.getAddress()));

  await pil.mint(oneEther.mul(10_000_000));
  for (let i = 0; i < 10; i++) {
    if (i > 0) {
      await pil.transfer(userAddrs[i], oneEther.mul(1_000_000));
    }
    await pil.connect(users[i]).approve(coreAddr, oneEther.mul(1_000_000));
  }

  const testERC721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestERC721', 'TERC721');

  await managingFacet.createPool(pil.address, 1, 0);

  for (let i = 0; i < 10; i++) {
    console.log(`Generating test data... ${i}/10`);
    const lister = users[i];
    const listBuyBid = async (j: number) => {
      const nftId = await mintNft(testERC721, lister);
      await testERC721.connect(lister).approve(coreAddr, nftId);
      const listResult = await runRWMethod({
        method: listingFacet
          .connect(lister)
          .list(
            testERC721.address,
            nftId,
            oneEther.mul(randInt(100, 1000)).div(1000),
            pilAddr,
            [`Tag${j % 5}`],
            dummyIpfsHash,
          ),
        name: 'List',
      });
      const metaNftId = listResult._metaNftId;

      const buyRounds = async () => {
        const traderIdx = randInt(0, 10);
        const trader = users[traderIdx];
        await ammFacet
          .connect(trader)
          .buyExactRoundsWithBases(
            metaNftId,
            oneEther.mul(1_000_000),
            afterRoundFee(oneEther.mul(randInt(1, 10))),
            deadline,
          );
      };
      await Promise.all([...Array(randInt(1, 5)).keys()].map(() => buyRounds()));

      const bid = async (k: number) => {
        const bidderIdx = (i + k + 1) % 10;
        const bidder = users[bidderIdx];
        const nftPrice = (await listingFacet.quoteNft(metaNftId))[0];
        const metaNftPrice = await listingFacet.quoteMetaNft(metaNftId);
        Promise.all([
          listingFacet
            .connect(bidder)
            .bidNft(
              metaNftId,
              nftPrice,
              deadline,
            ),
          listingFacet
            .connect(bidder)
            .bidMetaNft(
              metaNftId,
              metaNftPrice,
              deadline,
            ),
        ]);
      };
      await Promise.all([...Array(randInt(1, 5)).keys()].map(k => bid(k)));
    };

    await Promise.all([...Array(5).keys()].map(j => listBuyBid(j)));
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
