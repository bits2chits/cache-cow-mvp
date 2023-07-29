import Web3 from "web3";
import { autoInjectable, singleton } from "tsyringe";
import { RpcCollection, Chain } from '../enums/rpcs';

@autoInjectable()
@singleton()
export class Web3Wrapper {
  private instances: { [key in Chain]?: Web3 } = {}
  constructor(private rpcCollection: RpcCollection) {}

  getWeb3(chain: Chain): Web3 {
    if (!this.instances[chain]) {
      this.instances[chain] = new Web3(this.rpcCollection.getWeb3Provider(chain))
    }
    return this.instances[chain]
  }
}