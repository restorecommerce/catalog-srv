import { ResourcesAPIBase, ServiceBase, } from '@restorecommerce/resource-base-interface';
import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';

export class ProductService extends ServiceBase {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('product', topic, logger, new ResourcesAPIBase(db, 'products'), enableEvents);
  }
}

export class ProductPrototypeService extends ServiceBase {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('product_prototype', topic, logger, new ResourcesAPIBase(db, 'product_prototypes'), enableEvents);
  }
}

export class ProductCategoryService extends ServiceBase {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('product_category', topic, logger, new ResourcesAPIBase(db, 'product_categorys'), enableEvents);
  }
}

export class PriceGroupService extends ServiceBase {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('price_group', topic, logger, new ResourcesAPIBase(db, 'price_groups'), enableEvents);
  }
}

export class ManufacturerService extends ServiceBase {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('manufacturer', topic, logger, new ResourcesAPIBase(db, 'manufacturers'), enableEvents);
  }
}
