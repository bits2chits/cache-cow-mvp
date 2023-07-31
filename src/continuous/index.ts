import { poll } from '../poller';
import BlockEvents from '../events/node/block-events';
import { Chain } from '../enums/rpcs';
import { BlockProcessor } from '../poller/block-processor/block-processor';
import UniswapObserverState from '../../uniswapFactoryObserver.state.json';
import { fetchBlockNumber } from './utils';

async function main(
  chain = Chain.Polygon,
  blockEvents = new BlockEvents(),
  blockProcessor = new BlockProcessor(UniswapObserverState.observedEventSignatures),
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

main()
  .then(() => console.info('Process exited successfully'))
  .catch(console.error);
