import { ResourcesAPIBase, ServiceBase, } from '@restorecommerce/resource-base-interface';
import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import { ServiceServiceImplementation as ProductServiceImplementation, ProductList, ProductListResponse } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product';
import { ServiceServiceImplementation as ProductPrototypeServiceImplementation, ProductPrototypeList, ProductPrototypeListResponse } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_prototype';
import {ServiceServiceImplementation as ProductCategoryServiceImplementation, ProductCategoryList, ProductCategoryListResponse} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_category';
import { ServiceServiceImplementation as PriceGroupServiceImplementation, PriceGroupList, PriceGroupListResponse } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/price_group';
import { ServiceServiceImplementation as ManufacturerServiceImplementation, ManufacturerList, ManufacturerListResponse, DeepPartial } from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/manufacturer';

export class ProductService extends ServiceBase<ProductListResponse, ProductList> implements ProductServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('product', topic, logger, new ResourcesAPIBase(db, 'products'), enableEvents);
  }
}

export class ProductPrototypeService extends ServiceBase<ProductPrototypeListResponse, ProductPrototypeList> implements ProductPrototypeServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('product_prototype', topic, logger, new ResourcesAPIBase(db, 'product_prototypes'), enableEvents);
  }
}

export class ProductCategoryService extends ServiceBase<ProductCategoryListResponse, ProductCategoryList> implements ProductCategoryServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('product_category', topic, logger, new ResourcesAPIBase(db, 'product_categorys'), enableEvents);
  }
}

export class PriceGroupService extends ServiceBase<PriceGroupListResponse, PriceGroupList> implements PriceGroupServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('price_group', topic, logger, new ResourcesAPIBase(db, 'price_groups'), enableEvents);
  }
}

export class ManufacturerService extends ServiceBase<ManufacturerListResponse, ManufacturerList> implements ManufacturerServiceImplementation
{
  constructor(topic: Topic, db: DatabaseProvider, private cfg: any, logger: any, enableEvents: boolean) {
    super('manufacturer', topic, logger, new ResourcesAPIBase(db, 'manufacturers'), enableEvents);
  }
}
