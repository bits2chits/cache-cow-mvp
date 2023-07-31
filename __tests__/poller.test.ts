import { jest } from '@jest/globals';
import { poll } from '../src/poller';
import { Chain } from '../src/enums/rpcs';
import { fetchBlockNumber } from '../src/continuous/utils';

jest.setTimeout(30000);

describe('Tests poller', () => {
  const chain = Chain.Polygon;
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(chain);
    await poll(chain, {
      interval: 500,
      startAtBlock: blockNumber,
      shouldStop: async (block) => {
        return block > blockNumber;
      },
      onAbort: async (block, interval) => {
        console.log(`This is how many time it took: ${interval}`);
        expect(block).toBeGreaterThan(blockNumber);
        expect(interval).toBeGreaterThanOrEqual(500);
      },
    });
  });
});
