import { Admin } from 'kafkajs';
import { KafkaService, KafkaServiceInstance } from './index';
import { ethers } from 'ethers';

const defaultTopicConfiguration = {
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
};

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
          ...defaultTopicConfiguration,
        }],
      });
    }
  }

  async createTopics(topics: string[]): Promise<void> {
    const admin = await this.getInstance();
    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics.filter((topic) => !existingTopics.includes(topic))
      .map((topic) => ({
        topic,
        ...defaultTopicConfiguration,
      }));
    await admin.createTopics({
      waitForLeaders: true,
      topics: topicsToCreate,
    });
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

class KafkaAdminFactory {
  async getAdmin(): Promise<KafkaAdmin> {
    const admin = new KafkaAdmin(KafkaServiceInstance);
    await admin.getInstance();
    return admin;
  }
}

export const AdminFactory = new KafkaAdminFactory();
