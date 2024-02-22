import { ResourcesAPIBase, ServiceBase, } from '@restorecommerce/resource-base-interface';
import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import {
  ProductServiceImplementation, ProductList,
  ProductListResponse
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product.js';
import {
  ProductPrototypeServiceImplementation, ProductPrototypeList,
  ProductPrototypeListResponse
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_prototype.js';
import {
  ProductCategoryServiceImplementation, ProductCategoryList,
  ProductCategoryListResponse
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product_category.js';
import {
  PriceGroupServiceImplementation, PriceGroupList,
  PriceGroupListResponse
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/price_group.js';
import {
  ManufacturerServiceImplementation, ManufacturerList,
  ManufacturerListResponse
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/manufacturer.js';

export class ProductService extends ServiceBase<ProductListResponse, ProductList> implements ProductServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, cfg: any, logger: any, enableEvents: boolean) {
    let resourceFieldConfig;
    if (cfg.get('fieldHandlers')) {
      resourceFieldConfig = cfg.get('fieldHandlers');
      resourceFieldConfig['bufferFields'] = resourceFieldConfig?.bufferFields?.roles;
      if (cfg.get('fieldHandlers:timeStampFields')) {
        resourceFieldConfig['timeStampFields'] = [];
        for (let timeStampFiledConfig of cfg.get('fieldHandlers:timeStampFields')) {
          if (timeStampFiledConfig.entities.includes('products')) {
            resourceFieldConfig['timeStampFields'].push(...timeStampFiledConfig.fields);
          }
        }
      }
    }
    super('product', topic, logger, new ResourcesAPIBase(db, 'products', resourceFieldConfig), enableEvents);
  }
}

export class ProductPrototypeService extends ServiceBase<ProductPrototypeListResponse, ProductPrototypeList> implements ProductPrototypeServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, cfg: any, logger: any, enableEvents: boolean) {
    let resourceFieldConfig;
    if (cfg.get('fieldHandlers')) {
      resourceFieldConfig = cfg.get('fieldHandlers');
      resourceFieldConfig['bufferFields'] = resourceFieldConfig?.bufferFields?.roles;
      if (cfg.get('fieldHandlers:timeStampFields')) {
        resourceFieldConfig['timeStampFields'] = [];
        for (let timeStampFiledConfig of cfg.get('fieldHandlers:timeStampFields')) {
          if (timeStampFiledConfig.entities.includes('product_prototypes')) {
            resourceFieldConfig['timeStampFields'].push(...timeStampFiledConfig.fields);
          }
        }
      }
    }
    super('product_prototype', topic, logger, new ResourcesAPIBase(db, 'product_prototypes', resourceFieldConfig), enableEvents);
  }
}

export class ProductCategoryService extends ServiceBase<ProductCategoryListResponse, ProductCategoryList> implements ProductCategoryServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, cfg: any, logger: any, enableEvents: boolean) {
    let resourceFieldConfig;
    if (cfg.get('fieldHandlers')) {
      resourceFieldConfig = cfg.get('fieldHandlers');
      resourceFieldConfig['bufferFields'] = resourceFieldConfig?.bufferFields?.roles;
      if (cfg.get('fieldHandlers:timeStampFields')) {
        resourceFieldConfig['timeStampFields'] = [];
        for (let timeStampFiledConfig of cfg.get('fieldHandlers:timeStampFields')) {
          if (timeStampFiledConfig.entities.includes('product_categorys')) {
            resourceFieldConfig['timeStampFields'].push(...timeStampFiledConfig.fields);
          }
        }
      }
    }
    super('product_category', topic, logger, new ResourcesAPIBase(db, 'product_categorys', resourceFieldConfig), enableEvents);
  }
}

export class PriceGroupService extends ServiceBase<PriceGroupListResponse, PriceGroupList> implements PriceGroupServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, cfg: any, logger: any, enableEvents: boolean) {
    let resourceFieldConfig;
    if (cfg.get('fieldHandlers')) {
      resourceFieldConfig = cfg.get('fieldHandlers');
      resourceFieldConfig['bufferFields'] = resourceFieldConfig?.bufferFields?.roles;
      if (cfg.get('fieldHandlers:timeStampFields')) {
        resourceFieldConfig['timeStampFields'] = [];
        for (let timeStampFiledConfig of cfg.get('fieldHandlers:timeStampFields')) {
          if (timeStampFiledConfig.entities.includes('price_groups')) {
            resourceFieldConfig['timeStampFields'].push(...timeStampFiledConfig.fields);
          }
        }
      }
    }
    super('price_group', topic, logger, new ResourcesAPIBase(db, 'price_groups', resourceFieldConfig), enableEvents);
  }
}

export class ManufacturerService extends ServiceBase<ManufacturerListResponse, ManufacturerList> implements ManufacturerServiceImplementation {
  constructor(topic: Topic, db: DatabaseProvider, cfg: any, logger: any, enableEvents: boolean) {
    let resourceFieldConfig;
    if (cfg.get('fieldHandlers')) {
      resourceFieldConfig = cfg.get('fieldHandlers');
      resourceFieldConfig['bufferFields'] = resourceFieldConfig?.bufferFields?.roles;
      if (cfg.get('fieldHandlers:timeStampFields')) {
        resourceFieldConfig['timeStampFields'] = [];
        for (let timeStampFiledConfig of cfg.get('fieldHandlers:timeStampFields')) {
          if (timeStampFiledConfig.entities.includes('manufacturers')) {
            resourceFieldConfig['timeStampFields'].push(...timeStampFiledConfig.fields);
          }
        }
      }
    }
    super('manufacturer', topic, logger, new ResourcesAPIBase(db, 'manufacturers', resourceFieldConfig), enableEvents);
  }
}
