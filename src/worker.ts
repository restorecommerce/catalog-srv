import { createServiceConfig } from '@restorecommerce/service-config';
import * as _ from 'lodash';
import { Events, registerProtoMeta } from '@restorecommerce/kafka-client';
import { createLogger } from '@restorecommerce/logger';
import * as chassis from '@restorecommerce/chassis-srv';
import * as catalogServices from './service';
import { CatalogCommandInterface } from './commandInterface';
import { RedisClientType, createClient } from 'redis';
import { Arango } from '@restorecommerce/chassis-srv/lib/database/provider/arango/base';
import { Logger } from 'winston';
import { protoMetadata as manufacturerMeta, ServiceDefinition as manufacturer } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/manufacturer';
import { protoMetadata as priceGroupMeta, ServiceDefinition as price_group } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/price_group';
import { protoMetadata as productCategoryMeta, ServiceDefinition as product_category } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_category';
import { protoMetadata as productPorotoTypeMeta, ServiceDefinition as product_prototype } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_prototype';
import { protoMetadata as productMeta, ServiceDefinition as product } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product';
import { protoMetadata as commandInterfaceMeta, ServiceDefinition as CommandInterfaceServiceDefinition } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/commandinterface';
import { BindConfig } from '@restorecommerce/chassis-srv/lib/microservice/transport/provider/grpc';
import { HealthDefinition } from '@restorecommerce/rc-grpc-clients/dist/generated-server/grpc/health/v1/health';
import { ServerReflectionService } from 'nice-grpc-server-reflection';

registerProtoMeta(manufacturerMeta, priceGroupMeta, productCategoryMeta, productPorotoTypeMeta, productMeta, commandInterfaceMeta);

const ServiceDefinitions: any = [manufacturer, price_group, product_category, product_prototype, product];

const capitalized = (entity: string): string => {
  const labels = entity.split('_').map((element) => {
    return element.charAt(0).toUpperCase() + element.substr(1);
  });
  return _.join(labels, '');
};

const makeResourceConfig = (cfg: any, namespace: string, entity: string): any => {
  const kafkaCfg = cfg.get('events:kafka');
  // const serverCfg = cfg.get('server');

  // const crudMethods = ['create', 'update', 'upsert', 'read', 'delete'];
  const crudEvents = ['Created', 'Modified', 'Deleted'];

  const prefixesCfg = cfg.get(`resources:${namespace}`); // e.g: restorecommerce
  const topicName = `${prefixesCfg.serviceNamePrefix}${entity}s.resources`;


  kafkaCfg.topics = kafkaCfg.topics || {};
  kafkaCfg.topics[`${entity}s.resources`] = {
    topic: topicName
  };

  const messageObject = capitalized(entity);
  for (let event of crudEvents) {
    kafkaCfg[`${entity}${event}`] = {
      messageObject: `${prefixesCfg.serviceNamePrefix}${entity}.${messageObject}`
    };
  }

  cfg.set('events:kafka', kafkaCfg);
};

export class Worker {
  events: Events;
  server: any;
  logger: Logger;
  cfg: any;
  topics: any;
  offsetStore: chassis.OffsetStore;
  services: any;
  redisClient: RedisClientType;
  constructor(cfg?: any) {
    this.cfg = cfg || createServiceConfig(process.cwd());
    this.logger = createLogger(this.cfg.get('logger'));
    this.topics = {};
    this.services = {};
  }

  async start(): Promise<any> {
    // Load config
    const cfg = this.cfg;
    const logger = this.logger;
    const kafkaCfg = cfg.get('events:kafka');

    // database
    const db = await chassis.database.get(cfg.get('database:main'), logger);

    // topics
    logger.verbose('Setting up topics');
    // update 'evenets:kafka' to include all the resources Created, Modified and Deleted events
    const resourcesCfg = cfg.get('resources');
    for (let namespace in resourcesCfg) {
      const resourceCfg = resourcesCfg[namespace];

      const entities = resourceCfg.entities || [];
      for (let entity of entities) {
        makeResourceConfig(cfg, namespace, entity);
      }
    }
    const events = new Events(cfg.get('events:kafka'), logger);
    await events.start();
    this.offsetStore = new chassis.OffsetStore(events, cfg, logger);

    // Enable events firing for resource api using config
    let isEventsEnabled = cfg.get('events:enableEvents');
    if (isEventsEnabled === true) {
      isEventsEnabled = true;
    } else { // Undefined means events not enabled
      isEventsEnabled = false;
    }

    const redisConfig = cfg.get('redis');
    redisConfig.db = this.cfg.get('redis:db-indexes:db-subject');
    this.redisClient = createClient(redisConfig);

    // list of service names
    const serviceNamesCfg = cfg.get('serviceNames');
    const server = new chassis.Server(cfg.get('server'), logger);

    const cis = new CatalogCommandInterface(server, cfg, logger, events, this.redisClient);

    const eventListener = async (msg: any, context: any, config: any, eventName: string): Promise<any> => {
      // command events
      await cis.command(msg, context);
    };

    const topicTypes = _.keys(kafkaCfg.topics);
    for (let topicType of topicTypes) {
      const topicName = kafkaCfg.topics[topicType].topic;
      this.topics[topicType] = await events.topic(topicName);
      const offSetValue = await this.offsetStore.getOffset(topicName);
      logger.info('subscribing to topic with offset value', topicName, offSetValue);
      if (kafkaCfg.topics[topicType].events) {
        const eventNames = kafkaCfg.topics[topicType].events;
        for (let eventName of eventNames) {
          await this.topics[topicType].on(eventName,
            eventListener, { startingOffset: offSetValue });
        }
      }
    }

    const collections = cfg.get('database:main:collections');

    for (let entity of collections) {
      const serviceName = serviceNamesCfg[entity];
      if (serviceName) {
        const capitalizedName = capitalized(entity);
        this.services[entity] = new catalogServices[`${capitalizedName}Service`](
          this.topics[`${entity}s.resources`], db, cfg, logger, isEventsEnabled);
        const serviceDef = ServiceDefinitions.filter((obj) => obj.fullName.split('.')[2] === entity)[0];
        await server.bind(serviceName, {
          implementation: this.services[entity],
          service: serviceDef
        } as BindConfig<any>);
      }
    }

    // await server.bind(serviceNamesCfg.cis, cis);
    await server.bind(serviceNamesCfg.cis, {
      service: CommandInterfaceServiceDefinition,
      implementation: cis
    } as BindConfig<CommandInterfaceServiceDefinition>);

    // Add reflection service
    const reflectionServiceName = serviceNamesCfg.reflection;
    const reflectionService = chassis.buildReflectionService([
      { descriptor: manufacturerMeta.fileDescriptor },
      { descriptor: priceGroupMeta.fileDescriptor },
      { descriptor: productCategoryMeta.fileDescriptor },
      { descriptor: productPorotoTypeMeta.fileDescriptor },
      { descriptor: productMeta.fileDescriptor },
      { descriptor: commandInterfaceMeta.fileDescriptor }
    ]);
    await server.bind(reflectionServiceName, {
      service: ServerReflectionService,
      implementation: reflectionService
    });

    await server.bind(serviceNamesCfg.health, {
      service: HealthDefinition,
      implementation: new chassis.Health(cis, {
        readiness: async () => !!await ((db as Arango).db).version()
      })
    } as BindConfig<HealthDefinition>);

    // Start server
    await server.start();

    this.events = events;
    this.server = server;
    this.logger.info('Server started successfully');
  }

  async stop(): Promise<any> {
    this.logger.info('Shutting down');
    await this.server.stop();
    await this.events.stop();
    await this.offsetStore.stop();
  }
}

if (require.main === module) {
  const worker = new Worker();
  const logger = worker.logger;
  worker.start().then().catch((err) => {
    logger.error('startup error', { code: err.code, message: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('SIGINT', () => {
    worker.stop().then().catch((err) => {
      logger.error('shutdown error', { code: err.code, message: err.message, stack: err.stack });
      process.exit(1);
    });
  });
}
