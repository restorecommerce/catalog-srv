import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  ProductPrototypeServiceImplementation, ProductPrototypeList,
  ProductPrototypeListResponse,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_prototype.js';
import {
 AccessControlledServiceBase
} from '../experimental/AccessControlledServiceBase.js'

export class ProductPrototypeService
  extends AccessControlledServiceBase<ProductPrototypeListResponse, ProductPrototypeList>
  implements ProductPrototypeServiceImplementation
{
  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any,
    logger: any,
    enableEvents: boolean,
    resourceName: string = 'product_prototype',
    collectionName: string = 'product_prototypes',
  ) {
    super(resourceName, topic, db, cfg, logger, enableEvents, collectionName);
  }
}