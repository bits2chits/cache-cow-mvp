import { Web3 } from 'web3'
import { MATIC_USDC } from './enums/pairs'

// apprently this is necessary
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uniswapFactoryAbi = require('./abis/uniswap-factory.json')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uniswapV2Abi = require('./abis/uniswap-v2.json')

export async function fetchBlockNumber(web3: Web3): Promise<number> {
  return Number((await web3.eth.getBlockNumber()).toString())
}

interface Pair {
  token0: string
  token1: string
}

export async function fetchPairAddress(web3: Web3, pair: Pair): Promise<string> {
  const uniswapFactoryContract = new web3.eth.Contract(uniswapFactoryAbi, MATIC_USDC.QuickSwap_Address)
  const pairAddress = await (uniswapFactoryContract.methods as any).getPair(pair.token0, pair.token1).call()
  return pairAddress
}

interface Reserves {
  _reserve0: bigint
  _reserve1: bigint
  _blockTimestampLast: bigint
}

export async function getReserves(web3: Web3, address: string): Promise<Reserves> {
  const uniswapPairContract = new web3.eth.Contract(uniswapV2Abi, address)
  const reserves = await (uniswapPairContract.methods as any).getReserves().call()
  return reserves
}

interface PairPrice {
  token0Price: number
  token1Price: number
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function calcPrice(reserves: Reserves): PairPrice { // eslint-disable-line @typescript-eslint/no-explicit-any
  // The name parameter should be of type string. Any is used only to trigger the rule.
  return {
    token0Price: Number(parseInt(reserves._reserve0.toString().substring(0, 6)) / parseInt(reserves._reserve1.toString().substring(0, 6))) ,
    token1Price: Number(parseInt(reserves._reserve1.toString().substring(0, 6)) / parseInt(reserves._reserve0.toString().substring(0, 6))) 
  }
}