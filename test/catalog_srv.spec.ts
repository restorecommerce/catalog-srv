import * as should from 'should';
import { createChannel, createClient } from '@restorecommerce/grpc-client';
import { Worker } from '../src/worker';
import { createLogger } from '@restorecommerce/logger';
import { createServiceConfig } from '@restorecommerce/service-config';
import { ManufacturerServiceDefinition as manufacturer, ManufacturerList, ManufacturerServiceClient as ManufacturerClient } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/manufacturer';
import { PriceGroupServiceDefinition as price_group } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/price_group';
import { ProductCategoryServiceDefinition as product_category } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_category';
import { ProductPrototypeServiceDefinition as product_prototype } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_prototype';
import { ProductServiceDefinition as product } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product';
import { ReadRequest, Sort_SortOrder, DeleteRequest } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/resource_base';

const cfg = createServiceConfig(process.cwd());
const logger = createLogger(cfg.get('logger'));

const ServiceDefinitions: any = [manufacturer, price_group, product_category, product_prototype, product];
/**
 * Note: To run below tests a running Kafka, Redis and ArangoDB instance is required.
 * Kafka can be disabled if the config 'enableEvents' is set to false.
 */
const meta = {
  modified_by: 'AdminID',
  owners: [
    {
      id: 'urn:restorecommerce:acs:names:ownerIndicatoryEntity',
      value: 'urn:restorecommerce:acs:model:user.User',
      attributes: [{
        id: 'urn:restorecommerce:acs:names:ownerInstance',
        value: 'Admin'
      }]
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
  const options: any = { microservice: {} };
  options.microservice = {
    service: {},
    mapClients: new Map()
  };
  const resources = cfg.get('resources');
  const defaultConfig = cfg.get('client:default-catalog-srv');
  for (let resourceType in resources) {
    const resourceCfg = resources[resourceType];
    const protoPathPrefix = resourceCfg.protoPathPrefix;
    const serviceNamePrefix = resourceCfg.serviceNamePrefix;

    for (let service in resourceCfg.resources) {
      const serviceCfg = resourceCfg.resources[service]; // serviceCfg - [ 'address', 'contact_point_type']
      for (let resource of serviceCfg) {
        const packageName = `${serviceNamePrefix}${resource}`;
        const serviceName = 'Service';

        const fullServiceName = `${packageName}.${serviceName}`;
        try {
          const serviceDef = ServiceDefinitions.filter((obj) => obj.fullName.split('.')[2] === resource)[0];
          const client = createClient({ ...defaultConfig, logger }, serviceDef, createChannel(defaultConfig.address));
          options.microservice.service[fullServiceName] = client;
          options.microservice.mapClients.set(resource, fullServiceName);
          logger.verbose('connected to microservice: ' + fullServiceName);
        } catch (err) {
          logger.error('microservice connecting to service',
            fullServiceName, err);
        }
      }
    }
  }

  return options;
};

describe('catalog-srv testing', () => {
  let manufacturerSrv: ManufacturerClient;
  let worker: Worker;

  let baseValidation = (result: any) => {
    should.exist(result);
    should.exist(result.items);
    should.exist(result.operation_status);
    should.exist(result.operation_status.code);
    should.exist(result.operation_status.message);
    result.operation_status.code.should.equal(200);
    result.operation_status.message.should.equal('success');
  };

  beforeAll(async () => {
    worker = new Worker(cfg);
    await worker.start();

    const options = await getClientResourceServices();

    manufacturerSrv = options.microservice.service[options.microservice.mapClients.get('manufacturer')];
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should create manufacturer resource', async () => {
    const result = await manufacturerSrv.create(ManufacturerList.fromPartial({ items: listOfManufacturers }), {});
    baseValidation(result);
    result.items.should.be.length(listOfManufacturers.length);
    result.items[0].payload.name.should.equal(listOfManufacturers[0].name);
    result.items[1].payload.name.should.equal(listOfManufacturers[1].name);
  });

  it('should read manufacturer resource', async () => {
    const result = await manufacturerSrv.read(ReadRequest.fromPartial({
      sorts: [{
        field: 'name',
        order: Sort_SortOrder.ASCENDING,
      }]
    }), {});
    baseValidation(result);
    result.items.should.be.length(listOfManufacturers.length);
    result.items[0].payload.name.should.equal(listOfManufacturers[0].name);
    result.items[1].payload.name.should.equal(listOfManufacturers[1].name);
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
    const update = await manufacturerSrv.update(ManufacturerList.fromPartial({ items: changedManufacturerList }), {});
    baseValidation(update);
    update.items.should.be.length(2);
    const updatedResult = await manufacturerSrv.read(ReadRequest.fromPartial({
      sorts: [{
        field: 'name',
        order: Sort_SortOrder.ASCENDING,
      }]
    }), {});
    baseValidation(updatedResult);
    updatedResult.items.should.be.length(2);
    updatedResult.items[0].payload.name.should.equal('Manufacturer 3');
    updatedResult.items[1].payload.name.should.equal('Manufacturer 4');
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
    const upsert = await manufacturerSrv.upsert(ManufacturerList.fromPartial({ items: upsertedManufacturerList }), {});
    baseValidation(upsert);
    upsert.items.should.be.length(2);
    const upsertedResult = await manufacturerSrv.read(ReadRequest.fromPartial({
      sorts: [
        {
          field: 'modified',
          order: Sort_SortOrder.ASCENDING,
        },
        {
          field: 'name',
          order: Sort_SortOrder.ASCENDING
        }
      ]
    }));
    baseValidation(upsertedResult);
    upsertedResult.items.should.be.length(listOfManufacturers.length + 1);
    upsertedResult.items[0].payload.name.should.equal('Manufacturer 4');
    upsertedResult.items[1].payload.name.should.equal('Manufacturer 5');
    upsertedResult.items[2].payload.name.should.equal('Manufacturer 6');
  });

  it('should delete manufacturer resource', async () => {
    const result = await manufacturerSrv.read(ReadRequest.fromPartial({
      sorts: [{
        field: 'created',
        order: Sort_SortOrder.ASCENDING,
      }]
    }));
    baseValidation(result);

    const deleteIDs = {
      ids: result.items.map(i => i.payload.id)
    };

    const deletedResult = await manufacturerSrv.delete(DeleteRequest.fromPartial(deleteIDs), {});
    should.exist(deletedResult);
    deletedResult.status.length.should.equal(3);
    deletedResult.status.map((statusObj) => {
      statusObj.code.should.equal(200);
      statusObj.message.should.equal('success');
    });
    deletedResult.operation_status.code.should.equal(200);
    deletedResult.operation_status.message.should.equal('success');

    const resultAfterDeletion = await manufacturerSrv.read(ReadRequest.fromPartial({
      sorts: [{
        field: 'created',
        order: Sort_SortOrder.ASCENDING,
      }]
    }), {});
    baseValidation(resultAfterDeletion);
    resultAfterDeletion.items.should.be.length(0);

    const orgDeletionResult = await manufacturerSrv.delete({ collection: true });
    should.exist(orgDeletionResult);
    deletedResult.operation_status.code.should.equal(200);
    deletedResult.operation_status.message.should.equal('success');
  });
});
