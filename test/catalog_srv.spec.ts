import {} from 'mocha';
import should from 'should';
import { createChannel, createClient, GrpcClientConfig } from '@restorecommerce/grpc-client';
import { Worker } from '../src/worker.js';
import { createLogger } from '@restorecommerce/logger';
import { createServiceConfig } from '@restorecommerce/service-config';
import {
  ManufacturerServiceDefinition,
  ManufacturerList,
  ManufacturerServiceClient,
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/manufacturer.js';
import {
  ProductServiceDefinition,
  ProductServiceClient,
  ProductList,
  DeepPartial,
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/product.js';
import {
  ReadRequest, Sort_SortOrder, DeleteRequest
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/resource_base.js';
import { GrpcMockServer } from '@alenon/grpc-mock-server';
import {
  manufacturers,
  products,
  meta,
  subjects,
} from './mocks.js'
import { mockServices } from './utils.js';

const cfg = createServiceConfig(process.cwd());
const logger = createLogger(cfg.get('logger'));

/**
 * Note: To run below tests a running Kafka, Redis and ArangoDB instance is required.
 * Kafka can be disabled if the config 'enableEvents' is set to false.
 */
describe('The Catalog Service:', () => {
  let mocking: GrpcMockServer[];
  let manufacturerSrv: ManufacturerServiceClient;
  let productSrv: ProductServiceClient;
  let worker: Worker;

  const baseValidation = (result: any, itemsShouldexist: boolean = true) => {
    should.exist(result, 'result does not exist!');
    should.equal(result?.operationStatus?.message, 'success');
    if (itemsShouldexist) {
      should.exist(result.items, 'result.items does not exist!');
      result.items.should.matchEvery((item: any) => item.status?.code === 200);
    }
  };

  before(async function (): Promise<any> {
    mocking = await mockServices(cfg.get('client'));
    worker = new Worker(cfg);
    await worker.start();
    const manufacturerCfg = cfg.get('client:manufacturer');
    const productCfg = cfg.get('client:product');
    manufacturerSrv = createClient(
      {
        ...manufacturerCfg,
        logger
      } as GrpcClientConfig,
      ManufacturerServiceDefinition,
      createChannel(manufacturerCfg.address)
    );
    productSrv = createClient(
      {
        ...productCfg,
        logger
      } as GrpcClientConfig,
      ProductServiceDefinition,
      createChannel(productCfg.address)
    );
  });

  after(async () => {
    await manufacturerSrv?.delete({
      collection: true,
      subject: subjects.superadmin
    }),
    await productSrv?.delete({
      collection: true,
      subject: subjects.superadmin
    }),
    await worker.stop();
    await Promise.all(mocking?.map(mock => mock?.stop()))
  });

  describe('With Manufacturer Sub-Service:', () => {
    it('should create manufacturer resource', async () => {
      const result = await manufacturerSrv.create(ManufacturerList.fromPartial({ items: manufacturers }));
      baseValidation(result);
      result.items!.should.be.length(manufacturers.length);
      should.equal(result.items![0].payload!.name, manufacturers[0].name);
      should.equal(result.items![1].payload!.name, manufacturers[1].name);
    });

    it('should read manufacturer resource', async () => {
      const result = await manufacturerSrv.read(ReadRequest.fromPartial({
        sorts: [{
          field: 'name',
          order: Sort_SortOrder.ASCENDING,
        }],
        subject: subjects.superadmin
      }));
      baseValidation(result);
      result.items!.should.be.length(manufacturers.length);
      should.equal(result.items![0].payload!.name, manufacturers[0].name);
      should.equal(result.items![1].payload!.name, manufacturers[1].name);
    });

    it('should update manufacturer resource', async () => {
      const changedManufacturerList = [
        {
          id: manufacturers[0].id,
          name: 'Manufacturer 3',
          meta
        },
        {
          id: manufacturers[1].id,
          name: 'Manufacturer 4',
          meta
        }
      ];
      const update = await manufacturerSrv.update(
        ManufacturerList.fromPartial({ 
          items: changedManufacturerList,
          subject: subjects.superadmin
        }),
      );
      baseValidation(update);
      update.items!.should.be.length(2);
      const updatedResult = await manufacturerSrv.read(ReadRequest.fromPartial({
        sorts: [{
          field: 'name',
          order: Sort_SortOrder.ASCENDING,
        }],
        subject: subjects.superadmin
      }));
      baseValidation(updatedResult);
      updatedResult.items!.should.be.length(2);
      should.equal(updatedResult.items![0].payload!.name, 'Manufacturer 3');
      should.equal(updatedResult.items![1].payload!.name, 'Manufacturer 4');
    });

    it('should upsert manufacturer resource', async () => {
      const upsertedManufacturerList = [
        {
          id: manufacturers[0].id,
          name: 'Manufacturer 5',
          meta
        },
        {
          id: 'manufacturer-6',
          name: 'Manufacturer 6',
          description: 'Manufacturer 6 Description',
          meta
        }
      ];
      const upsert = await manufacturerSrv.upsert(ManufacturerList.fromPartial({
        items: upsertedManufacturerList,
        subject: subjects.superadmin,
      }));
      baseValidation(upsert);
      upsert.items!.should.be.length(2);
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
        ],
        subject: subjects.superadmin
      }));
      baseValidation(upsertedResult);
      upsertedResult.items!.should.be.length(manufacturers.length + 1);
      should.equal(upsertedResult.items![0].payload!.name, 'Manufacturer 4');
      should.equal(upsertedResult.items![1].payload!.name, 'Manufacturer 5');
      should.equal(upsertedResult.items![2].payload!.name, 'Manufacturer 6');
    });

    it('should delete manufacturer resource', async () => {
      const result = await manufacturerSrv.read(ReadRequest.fromPartial({
        sorts: [{
          field: 'created',
          order: Sort_SortOrder.ASCENDING,
        }],
        subject: subjects.superadmin
      }));
      baseValidation(result);

      const deleteIDs = {
        ids: result.items!.map(i => i.payload!.id) as string[],
        subject: subjects.superadmin,
      };

      const deletedResult = await manufacturerSrv.delete(DeleteRequest.fromPartial(deleteIDs));
      should.exist(deletedResult);
      deletedResult.status!.length.should.equal(3);
      deletedResult.status!.map((statusObj) => {
        statusObj.code!.should.equal(200);
        statusObj.message!.should.equal('success');
      });
      should.equal(deletedResult.operationStatus?.code, 200);
      should.equal(deletedResult.operationStatus?.message, 'success');

      const resultAfterDeletion = await manufacturerSrv.read(ReadRequest.fromPartial({
        sorts: [{
          field: 'created',
          order: Sort_SortOrder.ASCENDING,
        }],
        subject: subjects.superadmin
      }));
      baseValidation(resultAfterDeletion, false);
      should.not.exist(resultAfterDeletion.items);

      const orgDeletionResult = await manufacturerSrv.delete({
        collection: true,
        subject: subjects.superadmin,
      });
      should.exist(orgDeletionResult);
      should.equal(orgDeletionResult.operationStatus?.code, 200);
      should.equal(orgDeletionResult.operationStatus?.message, 'success');
    });
  });

  describe('With Product Sub-Service:', () => {
    it('should create product resource incl. variants', async () => {
      const result = await productSrv.create(products);
      baseValidation(result);
      result.items!.forEach(
        (item, i) => {
          const gt = products.items![i];
          should.equal(item.payload!.product!.name, gt!.product!.name);
          item.payload!.product!.physical!.variants!.forEach(
            (v, i) => should.equal(v.id, gt.product?.physical?.variants![i]!.id)
          );
          return true;
        }
      );
    });

    it('should read product resource incl. variants', async () => {
      const result = await productSrv.read({ subject: subjects.superadmin });
      baseValidation(result);
      result.items!.forEach(
        (item, i) => {
          const gt = products.items![i];
          should.equal(item.payload!.product!.name, gt!.product!.name);
          item.payload!.product!.physical!.variants!.forEach(
            (v, i) => should.equal(v.id, gt.product?.physical?.variants![i]!.id)
          );
          return true;
        }
      );
    });

    it('should partial update individual product variant', async () => {
      const change = 'New Product Name!';
      const result = await productSrv.update({
        items: [
          {
            id: products.items![0]!.id,
            product: {
              physical: {
                variants: [{
                  id: products.items![0]!.product!.physical!.variants![0]!.id!,
                  name: change,
                }],
              },
              meta: {
                modified: new Date(),
              }
            } as any,
            meta: {
              modified: new Date(),
            }
          }
        ],
        subject: subjects.superadmin
      });

      baseValidation(result);
      should.equal(result.items![0]!.payload!.product!.physical!.variants![0]!.name, change);
      const readResult = await productSrv.read({
        sorts: [{
          field: 'id',
          order: Sort_SortOrder.ASCENDING,
        }],
        subject: subjects.superadmin
      });
      products.items![0]!.product!.physical!.variants![0]!.name = change;
      readResult.items!.forEach(
        (item, i) => {
          const gt = products.items![i];
          should.equal(item.payload!.product!.name, gt!.product!.name);
          item.payload!.product!.physical!.variants!.forEach(
            (v, i) => should.equal(v.name, gt.product?.physical?.variants![i]!.name)
          );
          return true;
        }
      );
    });

    it('should get individual product variant in flat aggregation', async () => {
      const productId = products.items![0]!.id!;
      const variantId = products.items![0]!.product!.physical!.variants![2]!.id!
      const result = await productSrv.getVariant({
        items: [{
          productId,
          variantId,
        }],
        subject: subjects.superadmin
      });
      baseValidation(result, true);
    });

    it('should delete individual product variant without deleting product', async () => {
      const p_id = products.items![0]!.id!;
      const pv_id = products.items![0]!.product!.physical!.variants![0]!.id!
      const ids = [`${p_id}:physical:variants:${pv_id}`];
      const result = await productSrv.delete({
        ids,
        subject: subjects.superadmin
      });

      baseValidation(result, false);
      const readResult = await productSrv.read({
        sorts: [{
          field: 'id',
          order: Sort_SortOrder.ASCENDING,
        }],
        subject: subjects.superadmin
      });
      delete products.items![0]!.product!.physical!.variants![0];
      products.items![0]!.product!.physical!.variants = products.items![0]!.product!.physical!.variants?.filter(v => v);
      readResult.items!.forEach(
        (item, i) => {
          const gt = products.items![i];
          should.equal(item.payload!.product!.name, gt!.product!.name);
          item.payload!.product!.physical!.variants!.forEach(
            (v, i) => should.equal(v.name, gt.product?.physical?.variants![i]!.name)
          );
          return true;
        }
      );
    });
  });
});
