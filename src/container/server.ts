/* reflect-metadata is required for tsyringe */
import 'reflect-metadata';
import { Chain, RpcCollection } from '../enums/rpcs';
import { PoolRegistryProducer } from '../server/producers/pool-registry-producer';
import { PoolRegistryConsumer } from '../server/consumers/pool-registry-consumer';
import { EventProcessor } from '../server/processors/event-processor';
import { ContractRunner, JsonRpcProvider, WebSocketProvider, ethers } from 'ethers';
import UniswapV2Abi from '../abis/uniswap-v2.json'
import UniswapV3Abi from '../abis/uniswap-v3.json'
import Erc20Abi from '../abis/erc20.json';
import { EventSignature } from '../events/blockchain/types';
import { KafkaAdmin } from '../kafka/admin';
import { container } from 'tsyringe';
import { KafkaService } from '../kafka';

export enum CustomRegistry {
  PolygonRPCProvider = 'PolygonRPCProvider',
  KafkaAdmin = 'KafkaAdmin',
  UniswapV2SyncProcessor = 'UniswapV2SyncProcessor',
  UniswapV3SwapProcessor = 'UniswapV3SwapProcessor',
  PolygonPoolRegistryProducer = 'PolygonPoolRegistryProducer',
  UniswapV2Interface = 'UniswapV2Interface',
  UniswapV3Interface = 'UniswapV3Interface',
  Erc20Interface = 'Erc20Interface',
}

// this is to initialize async dependencies specifically since tsyringe doesn't have a way to do it
export async function initContainer(): Promise<void> {
  container.register<KafkaService>(KafkaService, { useValue: new KafkaService() })
  // bootstrap kafka topics
  container.register<KafkaAdmin>(KafkaAdmin, {
    useFactory: (c) => {
      const service = c.resolve<KafkaService>(KafkaService)
      return new KafkaAdmin(service)
    }
  })
  const kadmin = container.resolve<KafkaAdmin>(KafkaAdmin)
  await kadmin.getInstance()

  // abi interfaces
  container.register<ethers.Interface>(CustomRegistry.UniswapV2Interface, { useValue: new ethers.Interface(UniswapV2Abi) })
  container.register<ethers.Interface>(CustomRegistry.UniswapV3Interface, { useValue: new ethers.Interface(UniswapV3Abi) })
  container.register<ethers.Interface>(CustomRegistry.Erc20Interface, { useValue: new ethers.Interface(Erc20Abi) })

  // ethers provider for polygon
  container.register<ContractRunner | (JsonRpcProvider | WebSocketProvider)>(CustomRegistry.PolygonRPCProvider, {
    useFactory: (c) => {
      const rpcCollection = c.resolve(RpcCollection)
      return rpcCollection.getEthersProvider(Chain.Polygon)
    }
  })

  // polygon pool registry
  container.register(CustomRegistry.PolygonPoolRegistryProducer, {
    useFactory: (c) => {
      const provider = c.resolve<ContractRunner>(CustomRegistry.PolygonRPCProvider)
      const uniswapV2Interface = c.resolve<ethers.Interface>(CustomRegistry.UniswapV2Interface)
      const erc20Interface = c.resolve<ethers.Interface>(CustomRegistry.Erc20Interface)
      return new PoolRegistryProducer(provider, uniswapV2Interface, erc20Interface)
    }
  })

  // uniswap processors
  container.register(CustomRegistry.UniswapV2SyncProcessor, {
    useFactory: (c) => {
      const provider = c.resolve<JsonRpcProvider | WebSocketProvider>(CustomRegistry.PolygonRPCProvider)
      const registry = c.resolve(PoolRegistryConsumer)
      const v2 = c.resolve<ethers.Interface>(CustomRegistry.UniswapV2Interface)
      return new EventProcessor(provider, registry, EventSignature.Sync, v2)
    }
  })
  container.register(CustomRegistry.UniswapV3SwapProcessor, {
    useFactory: (c) => {
      const provider = c.resolve<JsonRpcProvider | WebSocketProvider>(CustomRegistry.PolygonRPCProvider)
      const registry = c.resolve(PoolRegistryConsumer)
      const v3 = c.resolve<ethers.Interface>(CustomRegistry.UniswapV3Interface)
      return new EventProcessor(provider, registry, EventSignature.SwapV3, v3)
    }
  })
}