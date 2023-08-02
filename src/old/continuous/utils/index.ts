import { RpcCollection } from '../../enums/rpcs';
import { ethers } from 'ethers';
import { MATIC_USDC } from '../../enums/pairs';
import { Pair } from '../price-processor/types';
import UniswapFactoryAbi from '../../abis/uniswap-factory.json';

const rpcCollection = new RpcCollection();
const uniswapFactoryInterface = new ethers.Interface(UniswapFactoryAbi);

export async function fetchBlockNumber(chain: string | symbol): Promise<number> {
  const provider = rpcCollection.getEthersProvider(chain);
  return provider.getBlockNumber();
}

export async function fetchPairAddress(chain: string | symbol, pair: Pair): Promise<string> {
  const uniswapContract = new ethers.Contract(MATIC_USDC.QuickSwap_Address, uniswapFactoryInterface, rpcCollection.getEthersProvider(chain));
  return await uniswapContract.getPair(pair.token0, pair.token1);
}

