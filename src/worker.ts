import {
  Server,
  OffsetStore,
  database,
  buildReflectionService,
  Health
} from '@restorecommerce/chassis-srv';
import {
  createServiceConfig,
  type ServiceConfig
} from '@restorecommerce/service-config';
import { Events, registerProtoMeta } from '@restorecommerce/kafka-client';
import {
  createLogger,
  type Logger,
} from '@restorecommerce/logger';
import { getService } from './services/index.js';
import { CatalogCommandInterface } from './commandInterface.js';
import { RedisClientType, createClient } from 'redis';
import { Arango } from '@restorecommerce/chassis-srv/lib/database/provider/arango/base.js';
import {
  protoMetadata as manufacturerMeta,
  ManufacturerServiceDefinition as manufacturer
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/manufacturer.js';
import {
  protoMetadata as priceGroupMeta,
  PriceGroupServiceDefinition as price_group
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/price_group.js';
import {
  protoMetadata as productCategoryMeta,
  ProductCategoryServiceDefinition as product_category
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_category.js';
import {
  protoMetadata as productPorotoTypeMeta,
  ProductPrototypeServiceDefinition as product_prototype
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_prototype.js';
import {
  protoMetadata as productMeta, ProductServiceDefinition as product
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product.js';
import {
  protoMetadata as commandInterfaceMeta,
  CommandInterfaceServiceDefinition as CommandInterfaceServiceDefinition
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/commandinterface.js';
import {
  protoMetadata as baseMeta,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/resource_base.js';
import { BindConfig } from '@restorecommerce/chassis-srv/lib/microservice/transport/provider/grpc/index.js';
import { HealthDefinition } from '@restorecommerce/rc-grpc-clients/dist/generated-server/grpc/health/v1/health.js';
import { ServerReflectionService } from 'nice-grpc-server-reflection';

registerProtoMeta(
  baseMeta,
  manufacturerMeta,
  priceGroupMeta,
  productCategoryMeta,
  productPorotoTypeMeta,
  productMeta,
  commandInterfaceMeta,
);

const ServiceDefinitions = [
  manufacturer,
  price_group,
  product_category,
  product_prototype,
  product
];

const capitalized = (entity: string): string => entity.split('_').map(
  element => element.charAt(0).toUpperCase() + element.slice(1)
).join('');

const makeResourceConfig = (cfg: any, namespace: string, entity: string, collection: string): any => {
  const kafkaCfg = cfg.get('events:kafka');
  const prefixesCfg = cfg.get(`resources:${namespace}`); // e.g: restorecommerce

  kafkaCfg.topics = kafkaCfg.topics ?? {};
  kafkaCfg.topics[`${collection}.resources`] = {
    topic: `${prefixesCfg.serviceNamePrefix}${collection}.resources`
  };

  const messageObject = capitalized(entity);
  for (const event of ['Created', 'Modified']) {
    kafkaCfg[`${entity}${event}`] = {
      messageObject: `${prefixesCfg.serviceNamePrefix}${entity}.${messageObject}`
    };
  }
  const deleteMessage = prefixesCfg.resourcesDeletedMessage ?? `${prefixesCfg.serviceNamePrefix}${entity}.Deleted`;
  for (const event of ['Deleted', 'DeletedAll']) {
    kafkaCfg[`${entity}${event}`] = {
      messageObject: deleteMessage,
    };
  }

  cfg.set('events:kafka', kafkaCfg);
};

export class Worker {
  events?: Events;
  server?: Server;
  offsetStore?: OffsetStore;
  redisClient?: RedisClientType;
  topics?: any = {};
  services?: any = {};
  cfg?: ServiceConfig;
  logger?: Logger;

  async start(cfg?: ServiceConfig, logger?: Logger): Promise<any> {
    // Load config
    this.cfg = cfg ??= createServiceConfig(process.cwd());
    this.logger = logger ??= createLogger(cfg.get('logger'));

    // create server
    this.server = new Server(cfg.get('server'), logger);
    const kafkaCfg = cfg.get('events:kafka');

    // database
    const db = await database.get(cfg.get('database:main'), logger);

    // topics
    logger.verbose('Setting up topics');
    // update 'evenets:kafka' to include all the resources Created, Modified and Deleted events
    const resourcesCfg = cfg.get('resources');
    for (const namespace in resourcesCfg) {
      const resourceCfg = resourcesCfg[namespace];
      const resources = resourceCfg.resources ?? [];
      for (const entry of resources) {
        makeResourceConfig(cfg, namespace, entry.resourceName, entry.collectionName);
      }
    }
    this.events = new Events(cfg.get('events:kafka'), logger);
    await this.events.start();
    this.offsetStore = new OffsetStore(this.events as any, cfg, logger);

    // Enable events firing for resource api using config (check for string because of env)
    const isEventsEnabled = cfg.get('events:enableEvents').toString() === 'true';
    const redisConfig = cfg.get('redis');
    redisConfig.db = this.cfg.get('redis:db-indexes:db-subject');
    this.redisClient = createClient(redisConfig);
    await this.redisClient.connect();

    // list of service names
    const serviceNamesCfg = cfg.get('serviceNames');
    const cis = new CatalogCommandInterface(this.server, cfg, logger, this.events, this.redisClient);
    const eventListener = async (msg: any, context: any, config: any, eventName: string): Promise<any> => {
      // command events
      await cis.command(msg, context);
    };

    for (const [topicKey, topicValue] of Object.entries<any>(kafkaCfg.topics)) {
      const topicName = topicValue.topic;
      this.topics[topicKey] = await this.events.topic(topicName);
      const offSetValue = await this.offsetStore.getOffset(topicName);
      logger.info('subscribing to topic with offset value', topicName, offSetValue);
      if (kafkaCfg.topics[topicKey].events) {
        const eventNames = kafkaCfg.topics[topicKey].events;
        for (const eventName of eventNames) {
          await this.topics[topicKey].on(
            eventName,
            eventListener,
            {
              startingOffset: offSetValue
            }
          );
        }
      }
    }

    for (const namespace in resourcesCfg) {
      for (const entry of resourcesCfg[namespace]?.resources ?? []) {
        const fullServiceName = serviceNamesCfg[entry.serviceName] ?? entry.serviceName;
        const serviceDef = ServiceDefinitions.find(
          (obj) => obj.fullName.split('.')[2] === entry.serviceName
        );
        if (fullServiceName && serviceDef) {
          const capitalizedName = capitalized(entry.serviceName);
          this.services[entry.serviceName] = new (getService(`${capitalizedName}Service`))(
            this.topics[`${entry.collectionName}.resources`],
            db,
            cfg,
            logger,
            isEventsEnabled,
            entry.resourceName,
            entry.collectionName,
          );
          await this.server.bind(fullServiceName, {
            implementation: this.services[entry.serviceName],
            service: serviceDef
          } as BindConfig<any>);
        }
      }
    }
    await this.server.bind(serviceNamesCfg.cis, {
      service: CommandInterfaceServiceDefinition,
      implementation: cis
    } as BindConfig<CommandInterfaceServiceDefinition>);

    // Add reflection service
    const reflectionService = buildReflectionService([
      { descriptor: manufacturerMeta.fileDescriptor as any },
      { descriptor: priceGroupMeta.fileDescriptor },
      { descriptor: productCategoryMeta.fileDescriptor },
      { descriptor: productPorotoTypeMeta.fileDescriptor },
      { descriptor: productMeta.fileDescriptor },
      { descriptor: commandInterfaceMeta.fileDescriptor }
    ]);
    await this.server.bind(serviceNamesCfg.reflection, {
      service: ServerReflectionService,
      implementation: reflectionService
    });
    await this.server.bind(serviceNamesCfg.health, {
      service: HealthDefinition,
      implementation: new Health(
        cis,
        {
          logger,
          cfg,
          dependencies: ['acs-srv'],
          readiness: () => (db as Arango).db.version().then(v => !!v)
        }
      )
    } as BindConfig<HealthDefinition>);
    
    // Start server
    await this.server.start();
    this.logger.info('Server started');
  }

  async stop(): Promise<any> {
    this.logger.info('Shutting down');
    await this.server.stop();
    await this.events.stop();
    await this.offsetStore.stop();
  }
}
