import { createServiceConfig } from '@restorecommerce/service-config';
import * as _ from 'lodash';
import { Events } from '@restorecommerce/kafka-client';
import { createLogger } from '@restorecommerce/logger';
import * as chassis from '@restorecommerce/chassis-srv';
import * as catalogServices from './service';
import { CatalogCommandInterface } from './commandInterface';
import { RedisClient, createClient } from 'redis';
import { Arango } from '@restorecommerce/chassis-srv/lib/database/provider/arango/base';
import { Logger } from 'winston';

const capitalized= (entity: string): string => {
  const labels = entity.split('_').map((element) => {
    return element.charAt(0).toUpperCase() + element.substr(1);
  });
  return _.join(labels, '');
};

const makeResourceConfig = (cfg: any, namespace: string, entity: string): any => {
  const kafkaCfg = cfg.get('events:kafka');
  const serverCfg = cfg.get('server');

  const crudMethods = ['create', 'update', 'upsert', 'read', 'delete'];
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
      protos: [
        `${prefixesCfg.protoPathPrefix}${entity}.proto`,
      ],
      protoRoot: `${prefixesCfg.protoRoot}`,
      messageObject: `${prefixesCfg.serviceNamePrefix}${entity}.${messageObject}`
    };
  }

  cfg.set('events:kafka', kafkaCfg);

  const serviceName = `${prefixesCfg.serviceConfigPrefix}${entity}-srv`;
  const serviceCfg = serverCfg.services;
  serviceCfg[serviceName] = {};

  for (let crudMethod of crudMethods) {
    serviceCfg[serviceName][crudMethod] = {
      transport: [
        'grpcCatalog'
      ]
    };
  }

  cfg.set('server:services', serviceCfg);

  const transportsCfg = serverCfg.transports;
  for (let transport of transportsCfg) {
    if (transport.name == 'grpcCatalog') {
      transport.services[serviceName] = `${prefixesCfg.serviceNamePrefix}${entity}.Service`;
      transport.protos.push(`${prefixesCfg.protoPathPrefix}${entity}.proto`);
    }
  }

  cfg.set('server:transports', transportsCfg);
};

export class Worker {
  events: Events;
  server: any;
  logger: Logger;
  cfg: any;
  topics: any;
  offsetStore: chassis.OffsetStore;
  services: any;
  redisClient: RedisClient;
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

    const eventListener = async(msg: any, context: any, config: any, eventName: string): Promise<any> => {
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
      for (let serviceName in cfg.get('server:services')) {
        if (serviceName.includes(`${entity}-srv`)) {
          // main transport
          const capitalizedName = capitalized(entity);
          this.services[entity] = new catalogServices[`${capitalizedName}Service`](
            this.topics[`${entity}s.resources`], db, cfg, logger, isEventsEnabled);
          await server.bind(serviceName, this.services[entity]);
        }
      }
    }

    await server.bind(serviceNamesCfg.cis, cis);

    // Add reflection service
    const reflectionServiceName = serviceNamesCfg.reflection;
    const transportName = cfg.get(`server:services:${reflectionServiceName}:serverReflectionInfo:transport:0`);
    const transport = server.transport[transportName];
    const reflectionService = new chassis.grpc.ServerReflection(transport.$builder, server.config);
    await server.bind(reflectionServiceName, reflectionService);

    await server.bind(serviceNamesCfg.health, new chassis.Health(cis, {
      readiness: async () => !!await ((db as Arango).db).version()
    }));

    // Start server
    await server.start();

    this.events = events;
    this.server = server;
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
    console.log(err);
    logger.error('startup error', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    worker.stop().then().catch((err) => {
      logger.error('shutdown error', err);
      process.exit(1);
    });
  });
}
