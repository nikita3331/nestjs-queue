import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  CACHE_REDIS_HOST,
  CACHE_REDIS_PASSWORD,
  CACHE_REDIS_PORT,
} from './env';

@Injectable()
export class EventsService {
  private redis: Redis;
  private subscriber: Redis;
  constructor() {
    this.redis = new Redis({
      host: CACHE_REDIS_HOST,
      port: Number(CACHE_REDIS_PORT),
      password: CACHE_REDIS_PASSWORD,
    });
    this.subscriber = new Redis({
      host: CACHE_REDIS_HOST,
      port: Number(CACHE_REDIS_PORT),
      password: CACHE_REDIS_PASSWORD,
    });
  }
  async publishMessage(
    queueName: string,
    payload: Record<string, any>,
  ): Promise<Array<Record<string, any>>> {
    let foundQueue: Array<Record<string, any>> = await this.redis
      .get(queueName)
      .then((data) => JSON.parse(data));
    if (!foundQueue) {
      foundQueue = [];
    }
    foundQueue.push(payload);
    await this.redis.set(queueName, JSON.stringify(foundQueue));
    await this.redis.publish(`${queueName}-notifications`, 'Key updated');
    return foundQueue;
  }
  async findAndUpdateQueue(
    queueName: string,
  ): Promise<Record<string, any> | null> {
    const foundQueue = await this.redis.get(queueName);
    if (foundQueue) {
      const parsedQueue = JSON.parse(foundQueue) as Array<Record<string, any>>;
      const firstInQueue = parsedQueue.shift();
      await this.redis.set(queueName, JSON.stringify(parsedQueue));
      await this.redis.publish(`${queueName}-notifications`, 'Key updated');
      return firstInQueue;
    }
  }
  async waitForMessage(
    queueName: string,
    timeout: number,
  ): Promise<Record<string, any> | null> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, timeout);
      const foundItemInQueue = await this.findAndUpdateQueue(queueName);
      if (foundItemInQueue) {
        return resolve(foundItemInQueue);
      }

      this.subscriber.subscribe(`${queueName}-notifications`, (error) => {
        if (error) {
          reject(error);
        }
      });

      this.subscriber.on('message', async (channel) => {
        if (channel === `${queueName}-notifications`) {
          clearTimeout(timeoutId);
          this.subscriber.unsubscribe(`${queueName}-notifications`);
          const foundItemInQueue = await this.findAndUpdateQueue(queueName);
          resolve(foundItemInQueue);
        }
      });
    });
  }
}
