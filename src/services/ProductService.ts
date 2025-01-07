import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  ProductServiceImplementation, ProductList,
  ProductListResponse,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product.js';
import {
 AccessControlledServiceBase
} from '../experimental/AccessControlledServiceBase.js'

export class ProductService
  extends AccessControlledServiceBase<ProductListResponse, ProductList>
  implements ProductServiceImplementation
{
  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any,
    logger: any,
    enableEvents: boolean
  ) {
    super('product', 'products', topic, db, cfg, logger, enableEvents);
  }
}