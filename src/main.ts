import { Chain, RpcCollection } from './enums/rpcs';
import { PoolRegistryProducer } from './server/pool-registry/pool-registry-producer';
import { PoolRegistryConsumer } from './server/pool-registry/pool-registry-consumer';
import { SyncEventProcessor } from './server/block-processor/sync-event-processor';
import { socketServer } from './server/socket-server/socket-server';
import { PriceAggregateProcessor } from './server/block-processor/price-aggregate-processor';

async function main(): Promise<void> {
  const chain = Chain.Polygon;
  const rpcCollection = new RpcCollection();
  const provider = rpcCollection.getEthersProvider(chain);

  const registryProducer = new PoolRegistryProducer(provider);
  const registry = new PoolRegistryConsumer();
  const syncEventProcessor = new SyncEventProcessor(provider, registry);
  const priceAggregateProcessor = new PriceAggregateProcessor(registry);

  await Promise.all([
    registryProducer.run(),
    registry.run(),
    syncEventProcessor.run(),
    priceAggregateProcessor.run(),
    socketServer(priceAggregateProcessor)
  ]);
}

main()
  .catch(console.error)
