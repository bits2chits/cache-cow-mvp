import { Chain, RpcCollection } from './enums/rpcs';
import { PoolRegistryProducer } from './server/pool-registry/pool-registry-producer';
import { PoolRegistryConsumer } from './server/pool-registry/pool-registry-consumer';
import { EventProcessor } from './server/block-processor/event-processor';
import { socketServer } from './server/socket-server/socket-server';
import { PriceAggregateProcessor } from './server/block-processor/price-aggregate-processor';
import { ethers } from 'ethers';
import UniswapV2Abi from './abis/uniswap-v2.json'
import UniswapV3Abi from './abis/uniswap-v3.json'
import { EventSignature } from './events/blockchain/types';

async function main(): Promise<void> {
  const chain = Chain.Polygon;
  const rpcCollection = new RpcCollection();
  const provider = rpcCollection.getEthersProvider(chain);

  const registryProducer = new PoolRegistryProducer(provider);
  const registry = new PoolRegistryConsumer();
  const uniswapV2EventProcessor = new EventProcessor(provider, registry, EventSignature.Sync, new ethers.Interface(UniswapV2Abi));
  const uniswapV3EventProcessor = new EventProcessor(provider, registry, EventSignature.SwapV3, new ethers.Interface(UniswapV3Abi));
  const priceAggregateProcessor = new PriceAggregateProcessor(registry);

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
