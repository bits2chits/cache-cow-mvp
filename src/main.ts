import { CustomRegistry, initContainer } from './container/server';
import { PoolRegistryProducer } from './server/producers/pool-registry-producer';
import { PoolRegistryConsumer } from './server/pool-registry/pool-registry-consumer';
import { EventProcessor } from './server/processors/event-processor';
import { socketServer } from './server/socket-server/socket-server';
import { PriceAggregateProcessor } from './server/processors/price-aggregate-processor';
import { container } from 'tsyringe';
import { StableCoinAggregateProcessor } from './server/processors/stable-coin-aggregate-processor';
import { HistoricalPricesProducer } from './server/producers/historical-prices-producer';


async function main(): Promise<void> {
  // resolve all container dependencies
  await initContainer();
  // LP Pool registry
  const poolRegistryProducer = container.resolve<PoolRegistryProducer>(CustomRegistry.PolygonPoolRegistryProducer);
  const poolRegistryConsumer = container.resolve<PoolRegistryConsumer>(PoolRegistryConsumer);

  // Event processors
  const uniswapV2EventProcessor = container.resolve<EventProcessor>(CustomRegistry.UniswapV2SyncProcessor);
  const uniswapV3EventProcessor = container.resolve<EventProcessor>(CustomRegistry.UniswapV3SwapProcessor);

  // Price processors
  const priceAggregateProcessor = container.resolve<PriceAggregateProcessor>(PriceAggregateProcessor);
  const stableCoinAggregateProcessor = container.resolve<StableCoinAggregateProcessor>(StableCoinAggregateProcessor);
  // Historical data producers
  const historicalPricesProducer = container.resolve<HistoricalPricesProducer>(HistoricalPricesProducer);

  await Promise.all([
    poolRegistryProducer.run(),
    poolRegistryConsumer.run(),
    uniswapV2EventProcessor.run(),
    uniswapV3EventProcessor.run(),
    priceAggregateProcessor.run(),
    historicalPricesProducer.run(),
    stableCoinAggregateProcessor.run(),
    socketServer(priceAggregateProcessor)
  ]);
}

main()
  .catch(console.error)
