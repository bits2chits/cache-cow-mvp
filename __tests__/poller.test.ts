import { MATIC_USDC } from '../src/enums/pairs';
import { fetchBlockNumber } from '../src/main';
import { Web3 } from 'web3'
import { poll } from '../src/poller';

describe('Tests poller', () => {
  const web3 = new Web3(MATIC_USDC.RPC)
  beforeEach((): void => {
    jest.setTimeout(100000);
  });
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(web3)
    await poll(web3, {
      interval: 500,
      startAtBlock: blockNumber,
      shouldStop: async (block) => {
        if (block > blockNumber) {
          return true
        } else {
          return false
        }
      },
      onAbort: async (block, interval) => {
        console.log(`This is how many time it took: ${interval}`)
        expect(block).toBeGreaterThan(blockNumber)
        expect(interval).toBeGreaterThanOrEqual(500)
      }
    })
  })
});

//"0xc35DADB65012eC5796536bD9864eD8773aBc74C4" // SUSHISWAP