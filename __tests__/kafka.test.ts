import {jest} from '@jest/globals'
import {uuidV4} from "web3-utils"
import {Web3} from "web3"
import {Producer, Message, KafkaMessage} from "kafkajs"
import {createConsumer, createProducer} from "../src/kafka"
import {kafkaAdminInstance} from "../src/kafka/admin"
import {sleep} from "../src/libs/sleep"

jest.setTimeout(100000)

function messageToString(m: Message | KafkaMessage): string {
  return m.value.toString()
}
describe('Tests Kafka', () => {
  let producer: Producer
  let testTopic: string

  beforeAll(async () => {
    testTopic = uuidV4()
    await kafkaAdminInstance.createTopic(testTopic)
    // initialize producer
    producer = await createProducer()
    await producer.connect()

  })
  afterAll(async () => {
    await producer?.disconnect()
    await kafkaAdminInstance.deleteTopic(testTopic)
    await kafkaAdminInstance.disconnect()
  })
  it('should produce a kafka message', async () => {
    const messageValue = uuidV4()
    const consumedMessages: KafkaMessage[] = []
    const consumer = await createConsumer({groupId: uuidV4()})
    await consumer.connect()
    await consumer.subscribe({topic: testTopic})
    await consumer.run({
      eachMessage: async ({message}) => {
        consumedMessages.push(message)
      }
    })
    await producer.send({
      topic: testTopic,
      messages: [{
        key: uuidV4(),
        value: messageValue
      }]
    })

    while (consumedMessages.length < 1) {
      await sleep(100)
    }
    expect(consumedMessages.map(({value}) => value.toString())).toContain(messageValue)
    await consumer.disconnect()
  })
  it('should produce many kafka messages', async () => {
    const numberOfMessages = Math.floor(Math.random() * 100)
    const producedMessages: Message[] = new Array(numberOfMessages).fill({}).map(() => ({key: uuidV4(), value: uuidV4()}))
    const consumedMessages: KafkaMessage[] = []
    const consumer = await createConsumer({groupId: uuidV4()})
    await consumer.connect()
    await consumer.subscribe({topic: testTopic})
    await consumer.run({
      eachMessage: async ({message}) => {
        consumedMessages.push(message)
      }
    })
    await producer.send({
      topic: testTopic,
      messages: producedMessages
    })

    while (consumedMessages.length < producedMessages.length) {
      await sleep(100)
    }
    expect(consumedMessages.length).toEqual(numberOfMessages)
    expect(producedMessages.map(messageToString)).toStrictEqual(consumedMessages.map(messageToString))
    await consumer.disconnect()
  })
  it('should crate a topic from event signature', async () => {
    const eventSignature = 'Event(uint256)'
    const eventHash = (new Web3()).eth.abi.encodeEventSignature(eventSignature)
    await kafkaAdminInstance.createTopicFromEventSignature(eventSignature)
    const topics = await kafkaAdminInstance.listTopics()
    expect(topics).toContain(eventHash)
    await kafkaAdminInstance.deleteTopic(eventHash)
  })
});
