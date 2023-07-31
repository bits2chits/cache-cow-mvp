import { ETH_AAVE, MATIC_USDC } from '../src/enums/pairs';
import { calcPrice, fetchBlockNumber, fetchPairAddress, getReserves } from '../src/main';
import { Chain } from '../src/enums/rpcs';

describe('calculates price data for pair', () => {
  const chain = Chain.Polygon;
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(chain);
    console.log('blockNumber', blockNumber);
    expect(typeof blockNumber).toBe('number');
  });
  it('should fetch address for a pair of tokens', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    console.log('address', address);
    expect(typeof address).toBe('string');
  });
  it('should get reserves from address', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    const reserves = await getReserves(chain, address);
    console.log('reserves', reserves);
    expect(typeof reserves._reserve0).toBe('bigint');
    expect(typeof reserves._reserve1).toBe('bigint');
    expect(typeof reserves._blockTimestampLast).toBe('bigint');
  });
  it('should calculate price data for matic usdc', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    const reserves = await getReserves(chain, address);
    const price = calcPrice(reserves);
    console.log('price', price);
    expect(typeof price.token0Price).toEqual('number');
    expect(typeof price.token1Price).toEqual('number');
  });
  it('should calculate price data for eth aave', async () => {
    const address = await fetchPairAddress(chain, { token0: ETH_AAVE.ETH, token1: ETH_AAVE.AAVE });
    const reserves = await getReserves(chain, address);
    const price = calcPrice(reserves);
    console.log('price', price);
    expect(typeof price.token0Price).toEqual('number');
    expect(typeof price.token1Price).toEqual('number');
  });
});

