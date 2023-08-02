import { Chain, RpcCollection } from './enums/rpcs';
import { PoolRegistryProducer } from './server/pool-registry/pool-registry-producer';
import { PoolRegistryConsumer } from './server/pool-registry/pool-registry-consumer';
import { SyncEventProcessor } from './server/block-processor/sync-event-processor';
import { socketServer } from './server/socket-server/socket-server';

async function main(): Promise<void> {
  const chain = Chain.Polygon;
  const rpcCollection = new RpcCollection();
  const provider = rpcCollection.getEthersProvider(chain);
  provider.pollingInterval = 2000;

  const registryProducer = new PoolRegistryProducer(provider);
  const registry = new PoolRegistryConsumer(provider);
  const syncEventProcessor = new SyncEventProcessor(provider, registry);

  await Promise.all([
    registryProducer.run(),
    registry.run(),
    syncEventProcessor.run(),
    socketServer(registry)
  ]);
}

main()
  .catch(console.error)
