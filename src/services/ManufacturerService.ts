import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  ManufacturerServiceImplementation, ManufacturerList,
  ManufacturerListResponse,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/manufacturer.js';
import {
 AccessControlledServiceBase
} from '../experimental/AccessControlledServiceBase.js'

export class ManufacturerService
  extends AccessControlledServiceBase<ManufacturerListResponse, ManufacturerList>
  implements ManufacturerServiceImplementation
{
  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any,
    logger: any,
    enableEvents: boolean,
    resourceName: string = 'manufacturer',
    collectionName: string = 'manufacturers',
  ) {
    super(resourceName, topic, db, cfg, logger, enableEvents, collectionName);
  }
}