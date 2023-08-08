import { Admin } from 'kafkajs';
import { KafkaService, SYSTEM_EVENT_TOPICS } from './index';
import { ethers } from 'ethers';

export class KafkaAdmin {
  kafkaService: KafkaService;
  admin: Admin;

  constructor(kafkaService: KafkaService) {
    this.kafkaService = kafkaService;
    process.on('exit', async () => {
      await this.admin?.disconnect();
    });
  }

  async getInstance(): Promise<Admin> {
    if (!this.admin) {
      this.admin = await this.kafkaService.createAdmin();
      await this.admin.connect();
      const topics = await this.listTopics();
      for (const topic of Object.values(SYSTEM_EVENT_TOPICS)) {
        if (!topics.includes(topic)) {
          await this.createTopic(topic);
        }
      }
    }
    return this.admin;
  }

  async createTopicFromEventSignature(eventSignature: string): Promise<void> {
    const eventHash = ethers.id(eventSignature);
    await this.createTopic(eventHash);
  }

  async createTopic(topic: string): Promise<void> {
    const admin = await this.getInstance();
    const topics = await admin.listTopics();
    if (!topics.includes(topic)) {
      await admin.createTopics({
        waitForLeaders: true,
        topics: [{
          topic,
          numPartitions: 1,
          configEntries: [
            {
              name: 'cleanup.policy',
              value: 'compact',
            },
            {
              name: 'retention.ms',
              value: '-1',
            },
          ],
        }],
      });
    }
  }

  async deleteTopic(topic: string): Promise<void> {
    const admin = await this.getInstance();
    await admin.deleteTopics({
      topics: [topic],
    });
  }

  async listTopics(): Promise<string[]> {
    const admin = await this.getInstance();
    return admin.listTopics();
  }

  async disconnect(): Promise<void> {
    await this.admin?.disconnect();
  }
}
