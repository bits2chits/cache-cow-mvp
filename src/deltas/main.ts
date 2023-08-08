import { initContainer } from '../container/server';
import { PoolRegistryConsumer } from '../server/consumers/pool-registry-consumer';
import { MultipoolPriceConsumer } from '../server/consumers/multipool-price-consumer';
import { socketServer } from './socket-server';
import { container } from 'tsyringe';

async function main(): Promise<void> {
  await initContainer()
  const registry = container.resolve<PoolRegistryConsumer>(PoolRegistryConsumer);
  const multiPoolPriceConsumer = container.resolve<MultipoolPriceConsumer>(MultipoolPriceConsumer);

  await Promise.all([
    registry.run(),
    multiPoolPriceConsumer.run(),
    socketServer(multiPoolPriceConsumer),
  ]);
}

main()
  .catch(console.error);
