import { Chain, RpcCollection } from '../enums/rpcs';
import { UniswapFactoryObserver } from './uniswap-observer';
import uniswapState from '../../uniswapFactoryObserver.state.json';
import { LpPoolProcessor } from './lp-pool-processor';
import { AdminFactory } from '../kafka/admin';

const rpcCollection = new RpcCollection()
async function processHistoricalEvents(): Promise<void> {
  const uniswapFactoryObserver = new UniswapFactoryObserver(Chain.Polygon, uniswapState.observedEventSignatures);
  const blockNumber = await rpcCollection.getEthersProvider(Chain.Polygon).getBlockNumber();
  await uniswapFactoryObserver.scanForUniswapFactories(uniswapState.lastBlockChecked, blockNumber)
    .then(() => console.info('Done processing historical events'))
    .catch(console.error)
    .finally(async () => await uniswapFactoryObserver.shutdown());
}

async function handleLpPoolAddedEvents(): Promise<void> {
  const lpPoolProcessor = new LpPoolProcessor();
}

async function main(reset: boolean): Promise<void> {
  if (reset) {
    const admin = await AdminFactory.getAdmin();
    for (const topic of await admin.listTopics()) {
      await admin.deleteTopic(topic);
    }
    await admin.disconnect();
  } else {
    processHistoricalEvents()
      .then(() => console.log('Historical events process shutdown'))
      .catch(console.error);
    handleLpPoolAddedEvents()
      .then(() => console.log('LP Pool Added process shutdown'))
      .catch(console.error);
  }
}

main(true)
  .then(() => console.info('Process exited successfully'))
  .catch(console.error);
