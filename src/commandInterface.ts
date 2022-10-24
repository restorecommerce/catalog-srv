import * as chassis from '@restorecommerce/chassis-srv';
import { Events } from '@restorecommerce/kafka-client';
import { RedisClientType } from 'redis';

export class CatalogCommandInterface extends chassis.CommandInterface {
  constructor(server: chassis.Server, cfg: any, logger: any, events: Events, redisClient: RedisClientType) {
    super(server, cfg, logger, events, redisClient);
  }
}
