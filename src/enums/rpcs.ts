import {JsonRpcProvider} from "ethers"

enum ChainRpcUrls {
  Polygon = "https://polygon-mainnet-archive.allthatnode.com:8545/bHsmKCKL5OfLrxcdoAaEaA7ZGbzfsbXA"// "https://polygon-rpc.com/"
}
export enum Chain {
  Polygon = "Polygon"
}

type EthersRpcProviders = {
  [key: string | symbol]: JsonRpcProvider
}

export class RpcCollection {
  ethersProviders: EthersRpcProviders = {}

  constructor() {
    this.ethersProviders[Chain.Polygon] = new JsonRpcProvider(ChainRpcUrls.Polygon)
  }

  getEthersProvider(chain: string | symbol): JsonRpcProvider {
    return this.ethersProviders[chain]

  }
}



