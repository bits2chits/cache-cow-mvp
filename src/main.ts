import { CustomRegistry, initContainer } from './container/server';
import { PoolRegistryProducer } from './server/pool-registry/pool-registry-producer';
import { PoolRegistryConsumer } from './server/pool-registry/pool-registry-consumer';
import { EventProcessor } from './server/block-processor/event-processor';
import { socketServer } from './server/socket-server/socket-server';
import { PriceAggregateProcessor } from './server/block-processor/price-aggregate-processor';
import { container } from 'tsyringe';


async function main(): Promise<void> {
  // resolve all container dependencies
  await initContainer();
  const registryProducer = container.resolve<PoolRegistryProducer>(CustomRegistry.PolygonPoolRegistryProducer);
  const registry = container.resolve<PoolRegistryConsumer>(PoolRegistryConsumer);
  const uniswapV2EventProcessor = container.resolve<EventProcessor>(CustomRegistry.UniswapV2SyncProcessor);
  const uniswapV3EventProcessor = container.resolve<EventProcessor>(CustomRegistry.UniswapV3SwapProcessor);
  const priceAggregateProcessor = container.resolve<PriceAggregateProcessor>(PriceAggregateProcessor);

  await Promise.all([
    registryProducer.run(),
    registry.run(),
    uniswapV2EventProcessor.run(),
    uniswapV3EventProcessor.run(),
    priceAggregateProcessor.run(),
    socketServer(priceAggregateProcessor)
  ]);
}

main()
  .catch(console.error)
