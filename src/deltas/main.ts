import { Chain, RpcCollection } from '../enums/rpcs';
import { PoolRegistryConsumer } from '../server/pool-registry/pool-registry-consumer';
import { MultipoolPriceConsumer } from '../server/consumers/multipool-price-consumer';
import { socketServer } from './socket-server';

async function main(): Promise<void> {
  const chain = Chain.Polygon;
  const rpcCollection = new RpcCollection();
  const provider = rpcCollection.getEthersProvider(chain);
  provider.pollingInterval = 2000;

  const registry = new PoolRegistryConsumer();
  const multiPoolPriceConsumer = new MultipoolPriceConsumer(registry);

  await Promise.all([
    registry.run(),
    multiPoolPriceConsumer.run(),
    socketServer(multiPoolPriceConsumer),
  ]);
}

main()
  .catch(console.error);
