import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  PhysicalProduct,
  VirtualProduct,
  ServiceProduct,
  PhysicalVariant,
  VirtualVariant,
  ServiceVariant,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product.js';
import { Subject } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/auth.js';
import { OperationStatus, Status } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/status.js';
import { ResourcesAPIBase, ServiceBase } from '@restorecommerce/resource-base-interface';

export type ProductNature = PhysicalProduct & VirtualProduct & ServiceProduct;
export type ProductVariant = PhysicalVariant & VirtualVariant & ServiceVariant;

export interface ProductVariantList {
  items?: ProductVariant[],
  total_count?: number,
  subject?: Subject,
}

export interface ProductVariantResponse {
  payload?: ProductVariant,
  status?: Status,
}

export interface ProductVariantListResponse {
  items?: ProductVariantResponse[],
  total_count?: number,
  operation_status?: OperationStatus,
}

export class ProductVariantService
  extends ServiceBase<ProductVariantListResponse, ProductVariantList>
{
  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any,
    logger: any,
    enableEvents: boolean,
    resourceName: string = 'product_variant',
    collectionName: string = 'product_variants',
  ) {
    const fieldHandlers = cfg.get('fieldHandlers');
    fieldHandlers.bufferedFields = fieldHandlers.bufferedFields?.flatMap(
      (item: any) => typeof(item) === 'string'
        ? item
        : item.entities?.includes(collectionName)
        ? item.fields
        : item.entities
        ? []
        : item.fields
    );
    fieldHandlers.timeStampFields = fieldHandlers.timeStampFields?.flatMap(
      (item: any) => typeof(item) === 'string'
        ? item
        : item.entities?.includes(collectionName)
        ? item.fields
        : item.entities
        ? []
        : item.fields
    );
    const graph = cfg.get('graph');
    super(
      resourceName,
      topic as any,
      logger,
      new ResourcesAPIBase(
        db,
        collectionName,
        fieldHandlers,
        graph?.vertices?.[collectionName],
        graph?.name,
        logger,
        resourceName
      ),
      false
    );
  }
}