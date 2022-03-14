import { deployAll } from '../scripts/deploy';

describe('Diamond', function () {
  it('Deploy All', async () => {
    await deployAll();
  });
});
