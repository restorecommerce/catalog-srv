import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';

import { ManufacturerService } from './ManufacturerService.js';
import { PriceGroupService } from './PriceGroupService.js';
import { ProductCategoryService } from './ProductCategoryService.js';
import { ProductPrototypeService } from './ProductPrototypeService.js';
import { ProductService } from './ProductService.js';

export { ManufacturerService } from './ManufacturerService.js';
export { PriceGroupService } from './PriceGroupService.js';
export { ProductCategoryService } from './ProductCategoryService.js';
export { ProductPrototypeService } from './ProductPrototypeService.js';
export { ProductService } from './ProductService.js';

export const getService = (name: string): {
  new(
    topic: Topic,
    db: DatabaseProvider,
    cfg: any, logger: any,
    enableEvents: boolean,
    resourceName?: string,
    collectionName?: string,
  ): object;
} => {
  switch (name) {
    case 'ProductService': return ProductService;
    case 'ProductPrototypeService': return ProductPrototypeService;
    case 'ProductCategoryService': return ProductCategoryService;
    case 'PriceGroupService': return PriceGroupService;
    case 'ManufacturerService': return ManufacturerService;
    default: throw new Error('Unknown Service!');
  }
};