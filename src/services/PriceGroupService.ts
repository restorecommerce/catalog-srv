import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  PriceGroupServiceImplementation, PriceGroupList,
  PriceGroupListResponse,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/price_group.js';
import {
 AccessControlledServiceBase
} from '../experimental/AccessControlledServiceBase.js'

export class PriceGroupService
  extends AccessControlledServiceBase<PriceGroupListResponse, PriceGroupList>
  implements PriceGroupServiceImplementation
{
  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any,
    logger: any,
    enableEvents: boolean,
    resourceName: string = 'price_group',
    collectionName: string = 'price_groups',
  ) {
    super(resourceName, topic, db, cfg, logger, enableEvents, collectionName);
  }
}