import { Chain, RpcCollection } from '../enums/rpcs';
import { UniswapFactoryObserver } from './uniswap-observer';
import uniswapState from '../../uniswapFactoryObserver.state.json';
import { LpPoolProcessor } from './lp-pool-processor';
import { AdminFactory } from '../kafka/admin';

const rpcCollection = new RpcCollection();

export async function startHistoricalDataFetching(): Promise<void> {
  const uniswapFactoryObserver = new UniswapFactoryObserver(Chain.Polygon, uniswapState.observedEventSignatures);
  const blockNumber = await rpcCollection.getEthersProvider(Chain.Polygon).getBlockNumber();
  await uniswapFactoryObserver.scanForUniswapFactories(uniswapState.lastBlockChecked, blockNumber)
    .then(() => console.info('Done processing historical events'))
    .catch(console.error)
    .finally(async () => await uniswapFactoryObserver.shutdown());
}


export async function startLpPoolProcessor(): Promise<void> {
  const lpPoolProcessor = new LpPoolProcessor();
  await lpPoolProcessor.initialize();
}
