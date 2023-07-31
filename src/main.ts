import { MATIC_USDC } from './enums/pairs';
import uniswapFactoryAbi from './abis/uniswap-factory.json';
import uniswapV2Abi from './abis/uniswap-v2.json';
import { RpcCollection } from './enums/rpcs';
import { ethers } from 'ethers';

const rpcCollection = new RpcCollection();
const uniswapFactoryInterface = new ethers.Interface(uniswapFactoryAbi);
const uniswapV2Interface = new ethers.Interface(uniswapV2Abi);

export async function fetchBlockNumber(chain: string | symbol): Promise<number> {
  const provider = rpcCollection.getEthersProvider(chain);
  return provider.getBlockNumber();
}


export interface Pair {
  token0: string;
  token1: string;
}

export async function fetchPairAddress(chain: string | symbol, pair: Pair): Promise<string> {
  const uniswapContract = new ethers.Contract(MATIC_USDC.QuickSwap_Address, uniswapFactoryInterface, rpcCollection.getEthersProvider(chain));
  return await uniswapContract.getPair(pair.token0, pair.token1);
}

export async function fetchPairAddresses(chain: string | symbol, address: string): Promise<Pair> {
  const uniswapPairContract = new ethers.Contract(address, uniswapV2Interface, rpcCollection.getEthersProvider(chain));
  const token0 = await uniswapPairContract.token0();
  const token1 = await uniswapPairContract.token1();
  return { token0, token1 };
}

export interface Reserves {
  _reserve0: bigint;
  _reserve1: bigint;
  _blockTimestampLast: bigint;
}

export async function getReserves(chain: string | symbol, address: string): Promise<Reserves> {
  const uniswapPairContract = new ethers.Contract(address, uniswapV2Interface, rpcCollection.getEthersProvider(chain));
  return await uniswapPairContract.getReserves();
}

interface PairPrice {
  token0Price: number;
  token1Price: number;
}

export function calcPrice(reserves: Reserves): PairPrice {
  // The name parameter should be of type string. Any is used only to trigger the rule.
  return {
    token0Price: Number(parseInt(reserves._reserve0.toString().substring(0, 6)) / parseInt(reserves._reserve1.toString().substring(0, 6))),
    token1Price: Number(parseInt(reserves._reserve1.toString().substring(0, 6)) / parseInt(reserves._reserve0.toString().substring(0, 6))),
  };
}
