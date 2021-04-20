import * as should from 'should';
import * as grpcClient from '@restorecommerce/grpc-client';
import { Worker } from '../src/worker';
import { createLogger } from '@restorecommerce/logger';
import { createServiceConfig } from '@restorecommerce/service-config';

const cfg = createServiceConfig(process.cwd());
const logger = createLogger(cfg.get('logger'));

/**
 * Note: To run below tests a running Kafka, Redis and ArangoDB instance is required.
 * Kafka can be disabled if the config 'enableEvents' is set to false.
 */
const meta = {
  modified_by: 'AdminID',
  owner: [
    {
      id: 'urn:restorecommerce:acs:names:ownerIndicatoryEntity',
      value: 'urn:restorecommerce:acs:model:user.User'
    },
    {
      id: 'urn:restorecommerce:acs:names:ownerInstance',
      value: 'Admin'
    }
  ]
};

const listOfManufacturers = [
  {
    id: 'manufacturer-1',
    name: 'Manufacturer 1',
    description: 'Manufacturer 1 Description',
    meta
  },
  {
    id: 'manufacturer-2',
    name: 'Manufacturer 2',
    description: 'Manufacturer 2 Description',
    meta
  },
];

// get client connection object
const getClientResourceServices = async () => {
  const options: any = {microservice: {}};
  options.microservice = {
    service: {},
    mapClients: new Map()
  };
  const resources = cfg.get('resources');
  const clientConfig = cfg.get('client');
  for (let resource in resources) {
    const resourceCfg = resources[resource];
    const resourceNames = resourceCfg.entities;
    const protosPrefix = resourceCfg.protoPathPrefix;
    const servicePrefix = resourceCfg.serviceNamePrefix;

    logger.silly('microservice clients', resourceNames);

    for (let resource of resourceNames) {
      if (resource === 'command') {
        const serviceName = 'io.restorecommerce.commandinterface.Service';
        const client = new grpcClient.Client(cfg.get('client:commandinterface'), logger);
        options.microservice.service[serviceName] = await client.connect();
        options.microservice.mapClients.set(resource, serviceName);
        continue;
      }
      const protos = [`${protosPrefix}/${resource}.proto`];
      const serviceName = `${servicePrefix}${resource}.Service`;
      const defaultConfig = clientConfig['default-catalog-srv'];
      defaultConfig.transports.grpc.protos = protos;
      defaultConfig.transports.grpc.service = serviceName;
      try {
        const client = new grpcClient.Client(defaultConfig, logger);
        options.microservice.service[serviceName] = await client.connect();
        options.microservice.mapClients.set(resource, serviceName);
        logger.verbose('connected to microservice', serviceName);
      } catch (err) {
        logger.error('microservice connecting to service',
          serviceName, err);
      }
    }
  }

  return options;
};

describe('catalog-srv testing', () => {
  let manufacturerSrv;
  let worker: Worker;

  let baseValidation = (result: any) => {
    should.exist(result);
    should.not.exist(result.error);
    should.exist(result.data);
    should.exist(result.data.items);
  };

  beforeAll(async () => {
    worker = new Worker(cfg);
    await worker.start();

    const serviceMapping = await getClientResourceServices();

    manufacturerSrv = serviceMapping.microservice.service[serviceMapping.microservice.mapClients.get('manufacturer')];
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should create manufacturer resource', async () => {
    const result = await manufacturerSrv.create({items: listOfManufacturers});
    baseValidation(result);
    result.data.items.should.be.length(listOfManufacturers.length);
    result.data.items[0].name.should.equal(listOfManufacturers[0].name);
    result.data.items[1].name.should.equal(listOfManufacturers[1].name);
  });

  it('should read manufacturer resource', async () => {
    const result = await manufacturerSrv.read({
      sort: [{
        field: 'name',
        order: 1,
      }]
    });
    baseValidation(result);
    result.data.items.should.be.length(listOfManufacturers.length);
    result.data.items[0].name.should.equal(listOfManufacturers[0].name);
    result.data.items[1].name.should.equal(listOfManufacturers[1].name);
  });

  it('should update manufacturer resource', async () => {
    const changedManufacturerList = [
      {
        id: listOfManufacturers[0].id,
        name: 'Manufacturer 3',
        meta
      },
      {
        id: listOfManufacturers[1].id,
        name: 'Manufacturer 4',
        meta
      }
    ];
    const update = await manufacturerSrv.update({items: changedManufacturerList});
    baseValidation(update);
    update.data.items.should.be.length(2);
    const updatedResult = await manufacturerSrv.read({
      sort: [{
        field: 'name',
        order: 1,
      }]
    });
    baseValidation(updatedResult);
    updatedResult.data.items.should.be.length(2);
    updatedResult.data.items[0].name.should.equal('Manufacturer 3');
    updatedResult.data.items[1].name.should.equal('Manufacturer 4');
  });

  it('should upsert manufacturer resource', async () => {
    const upsertedManufacturerList = [
      {
        id: listOfManufacturers[0].id,
        name: 'Manufacturer 5',
        meta
      },
      // New manufacturer created
      {
        id: 'manufacturer-6',
        name: 'Manufacturer 6',
        description: 'Manufacturer 6 Description',
        meta
      }
    ];
    const update = await manufacturerSrv.upsert({items: upsertedManufacturerList});
    baseValidation(update);
    update.data.items.should.be.length(2);
    const updatedResult = await manufacturerSrv.read({
      sort: [
        {
          field: 'modified',
          order: 1,
        },
        {
          field: 'name',
          order: 1
        }
      ]
    });
    baseValidation(updatedResult);
    updatedResult.data.items.should.be.length(listOfManufacturers.length + 1);
    updatedResult.data.items[0].name.should.equal('Manufacturer 4');
    updatedResult.data.items[1].name.should.equal('Manufacturer 5');
    updatedResult.data.items[2].name.should.equal('Manufacturer 6');
  });

  it('should delete manufacturer resource', async () => {
    const result = await manufacturerSrv.read({
      sort: [{
        field: 'created',
        order: 1,
      }]
    });
    baseValidation(result);

    const deleteIDs = {
      ids: result.data.items.map(i => i.id)
    };

    const deletedResult = await manufacturerSrv.delete(deleteIDs);
    should.exist(deletedResult);
    should.not.exist(deletedResult.error);

    const resultAfterDeletion = await manufacturerSrv.read({
      sort: [{
        field: 'created',
        order: 1,
      }]
    });
    baseValidation(resultAfterDeletion);
    resultAfterDeletion.data.items.should.be.length(0);

    const orgDeletionResult = await manufacturerSrv.delete({collection: true});
    should.exist(orgDeletionResult);
    should.not.exist(orgDeletionResult.error);
  });
});
