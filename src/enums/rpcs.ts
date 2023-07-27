
import {Web3, Web3BaseProvider} from "web3"
import {JsonRpcProvider} from "ethers"

enum ChainRpcUrls {
  Polygon = "https://polygon-rpc.com/"
}
export enum Chain {
  Polygon = "Polygon"
}

type EthersRpcProviders = {
  [key: string | symbol]: JsonRpcProvider
}

type Web3RpcProviders = {
  [key: string | symbol]: Web3BaseProvider
}
export class RpcCollection {
  web3Providers: Web3RpcProviders = {}
  ethersProviders: EthersRpcProviders = {}

  constructor() {
    this.web3Providers[Chain.Polygon] = new Web3.providers.HttpProvider(ChainRpcUrls.Polygon)
    this.ethersProviders[Chain.Polygon] = new JsonRpcProvider(ChainRpcUrls.Polygon)
  }

  getWeb3Provider(chain: string | symbol) : Web3BaseProvider {
    return this.web3Providers[chain]
  }
  getEthersProvider(chain: string | symbol): JsonRpcProvider {
    return this.ethersProviders[chain]
  }
}



