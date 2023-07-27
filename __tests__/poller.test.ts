import {jest} from '@jest/globals'
import { fetchBlockNumber } from '../src/main'
import { Web3 } from 'web3'
import { poll } from '../src/poller'
import {Chain, RpcCollection} from "../src/enums/rpcs"

jest.setTimeout(30000)

describe('Tests poller', () => {
  const rpcCollection = new RpcCollection()
  const web3 = new Web3(rpcCollection.getWeb3Provider(Chain.Polygon))
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(web3)
    await poll(web3, {
      interval: 500,
      startAtBlock: blockNumber,
      shouldStop: async (block) => {
        return block > blockNumber
      },
      onAbort: async (block, interval) => {
        console.log(`This is how many time it took: ${interval}`)
        expect(block).toBeGreaterThan(blockNumber)
        expect(interval).toBeGreaterThanOrEqual(500)
      }
    })
  })
})
