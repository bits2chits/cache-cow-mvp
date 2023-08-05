import { JsonRpcProvider, WebSocketProvider } from 'ethers';

enum ChainRpcUrls {
  PolygonOfficial = 'https://polygon-rpc.com/',
  PolygonFree = 'https://polygon-mainnet-archive.allthatnode.com:8545/bHsmKCKL5OfLrxcdoAaEaA7ZGbzfsbXA',
  PolygonPaid = 'https://polygon-mainnet-archive.allthatnode.com:8545/5WpBhQPKQL2C5N0psmIJcviQuOdN5owb',
  PolygonWebSocket = 'wss://polygon-mainnet-archive-ws.allthatnode.com:8545/5WpBhQPKQL2C5N0psmIJcviQuOdN5owb'
}

export enum Chain {
  Polygon = 'Polygon'
}

type EthersRpcProviders = {
  [key: string | symbol]: JsonRpcProvider | WebSocketProvider
}

export class RpcCollection {
  ethersProviders: EthersRpcProviders = {};

  constructor() {
    this.ethersProviders[Chain.Polygon] = new WebSocketProvider(ChainRpcUrls.PolygonWebSocket);
  }

  getEthersProvider(chain: string | symbol): JsonRpcProvider | WebSocketProvider {
    return this.ethersProviders[chain];

  }
}



