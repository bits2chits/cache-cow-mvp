import { jest } from '@jest/globals';
import { UniswapFactoryObserver } from '../../src/historical/uniswap-observer';
import { AdminFactory, KafkaAdmin } from '../../src/kafka/admin';
import { Chain } from '../../src/enums/rpcs';
import { ethers, Filter, Log } from 'ethers';

describe('Tests Uniswap Observer', () => {
  const contractAddress = '0x123';
  const eventSignature = 'Event(uint256)';
  let admin: KafkaAdmin;
  let eventSignatureHash: string;
  beforeAll(async () => {
    admin = await AdminFactory.getAdmin();
    eventSignatureHash = ethers.id(eventSignature);
  });
  afterAll(async () => {
    await admin?.disconnect();
  });

  it('should create a topic for each new uniswap factory address', async () => {
    const observer = new UniswapFactoryObserver(Chain.Polygon, [eventSignature]);
    const addAddressSpy = jest.spyOn(observer, 'addAddress');
    const getPastLogsSpy = jest.spyOn(observer, 'getPastLogs');
    getPastLogsSpy.mockImplementation((_: Filter) => {
      return Promise.resolve([{
        address: contractAddress,
      }] as Log[]);
    });
    await observer.scanForUniswapFactories(1, 2);
    const topics = await admin.listTopics();
    expect(addAddressSpy).toHaveBeenCalledTimes(1);
    expect(getPastLogsSpy).toHaveBeenCalledTimes(1);
    expect(topics).toContain(contractAddress);
    await admin.deleteTopic(contractAddress);
    await observer.shutdown();
  });
  it('should add topics to observedTopics', async () => {
    const observer = new UniswapFactoryObserver(Chain.Polygon, [eventSignature]);
    await expect(observer.logTopicIsObserved(eventSignatureHash)).resolves.toBeTruthy();
    await observer.shutdown();
  });
});
