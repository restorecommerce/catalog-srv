import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  ProductCategoryServiceImplementation, ProductCategoryList,
  ProductCategoryListResponse,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_category.js';
import {
 AccessControlledServiceBase
} from '../experimental/AccessControlledServiceBase.js'

export class ProductCategoryService
  extends AccessControlledServiceBase<ProductCategoryListResponse, ProductCategoryList>
  implements ProductCategoryServiceImplementation
{
  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any,
    logger: any,
    enableEvents: boolean,
    resourceName: string = 'product_category',
    collectionName: string = 'product_categories',
  ) {
    super(resourceName, topic, db, cfg, logger, enableEvents, collectionName);
  }
}