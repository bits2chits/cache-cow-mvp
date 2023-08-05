import { PoolRegistryConsumer } from '../server/pool-registry/pool-registry-consumer';
import { MultipoolPriceConsumer } from '../server/consumers/multipool-price-consumer';
import { socketServer } from './socket-server';

async function main(): Promise<void> {
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
