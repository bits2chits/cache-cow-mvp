import { poll } from '../poller';
import BlockEvents from '../events/node/block-events';
import { Chain } from '../enums/rpcs';
import { BlockProcessor } from '../poller/block-processor/block-processor';
import { fetchBlockNumber } from './utils';

export async function startContinuousDataPolling(
  chain: Chain,
  blockEvents: BlockEvents,
  blockProcessor: BlockProcessor
): Promise<void> {
  blockProcessor.initialize();
  let blockNumber = await fetchBlockNumber(chain);
  // @TODO register pair event listeners
  await poll(chain, {
    interval: 500,
    startAtBlock: blockNumber,
    shouldStop: async (block) => {
      if (block > blockNumber) {
        blockNumber = block;
        blockEvents.newBlock(chain, block);
      }
      return false;
    },
    onAbort: async () => {
      blockEvents.cleanup();
    },
  });
}
