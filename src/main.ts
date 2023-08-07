import { Chain, RpcCollection } from './enums/rpcs';
import { EventProcessor } from './server/processors/event-processor';
import { PoolRegistryProducer } from './server/producers/pool-registry-producer';
import { PriceAggregateProcessor } from './server/processors/price-aggregate-processor';
import { PoolRegistryConsumer } from './server/consumers/pool-registry-consumer';
import { socketServer } from './server/socket-server/socket-server';
import { ethers } from 'ethers';
import UniswapV2Abi from './abis/uniswap-v2.json'
import UniswapV3Abi from './abis/uniswap-v3.json'
import { EventSignature } from './events/blockchain/types';
import { AdminFactory } from './kafka/admin';
import { HistoricalPricesProducer } from './server/producers/historical-prices-producer';

async function main(): Promise<void> {
  // initialize admin to create necessary system topics.
  await AdminFactory.getAdmin();
  const chain = Chain.Polygon;
  const rpcCollection = new RpcCollection();
  const provider = rpcCollection.getEthersProvider(chain);

  // LP Pool registry
  const poolRegistryProducer = new PoolRegistryProducer(provider);
  const poolRegistryConsumer = new PoolRegistryConsumer();

  // Event processors
  const uniswapV2EventProcessor = new EventProcessor(provider, poolRegistryConsumer, EventSignature.Sync, new ethers.Interface(UniswapV2Abi));
  const uniswapV3EventProcessor = new EventProcessor(provider, poolRegistryConsumer, EventSignature.SwapV3, new ethers.Interface(UniswapV3Abi));

  // Price processors
  const priceAggregateProcessor = new PriceAggregateProcessor(poolRegistryConsumer);

  // Historical data producers
  const historicalPricesProducer = new HistoricalPricesProducer();

  await Promise.all([
    poolRegistryProducer.run(),
    poolRegistryConsumer.run(),
    uniswapV2EventProcessor.run(),
    uniswapV3EventProcessor.run(),
    priceAggregateProcessor.run(),
    historicalPricesProducer.run(),
    socketServer(priceAggregateProcessor)
  ]);
}

main()
  .catch(console.error)
