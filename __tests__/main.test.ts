
import { ETH_AAVE, MATIC_USDC } from '../src/enums/pairs';
import { calcPrice , fetchBlockNumber, fetchPairAddress, getReserves } from '../src/main';
import { Web3 } from 'web3'

describe('calculates price data for pair', () => {
  const web3 = new Web3(MATIC_USDC.RPC)
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(web3)
    console.log('blockNumber', blockNumber)
    expect(typeof blockNumber).toBe("number")
  });
  it('should fetch address for a pair of tokens', async () => {
    const address = await fetchPairAddress(web3, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC })
    console.log('address', address)
    expect(typeof address).toBe("string")
  })
  it('should get reserves from address', async () => {
    const address = await fetchPairAddress(web3, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC })
    const reserves = await getReserves(web3, address)
    console.log('reserves', reserves)
    expect(typeof reserves._reserve0).toBe("bigint")
    expect(typeof reserves._reserve1).toBe("bigint")
    expect(typeof reserves._blockTimestampLast).toBe("bigint")
  })
  it('should calculate price data for matic usdc', async () => {
    const address = await fetchPairAddress(web3, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC })
    const reserves = await getReserves(web3, address)
    const price = calcPrice(reserves)
    console.log('price', price)
    expect(typeof price.token0Price).toEqual('number')
    expect(typeof price.token1Price).toEqual('number')
  })
  it('should calculate price data for eth aave', async () => {
    const address = await fetchPairAddress(web3, { token0: ETH_AAVE.ETH, token1: ETH_AAVE.AAVE })
    const reserves = await getReserves(web3, address)
    const price = calcPrice(reserves)
    console.log('price', price)
    expect(typeof price.token0Price).toEqual('number')
    expect(typeof price.token1Price).toEqual('number')
  })
});

//"0xc35DADB65012eC5796536bD9864eD8773aBc74C4" // SUSHISWAP
