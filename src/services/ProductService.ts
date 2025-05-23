import { randomUUID } from 'crypto';
import { CallContext } from 'nice-grpc-common';
import { DatabaseProvider } from '@restorecommerce/chassis-srv';
import { Topic } from '@restorecommerce/kafka-client';
import { Sort_SortOrder } from '@restorecommerce/rc-grpc-clients';
import { ServiceConfig } from '@restorecommerce/service-config';
import { Logger } from '@restorecommerce/logger';
import {
  ProductServiceImplementation,
  ProductList,
  ProductListResponse,
  IndividualProductVariantListRequest,
  IndividualProductVariantListResponse,
  IndividualProductVariant,
  Product,
  DeepPartial,
  Session,
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/product.js';
import {
  DeleteRequest,
  DeleteResponse,
  Filter_Operation,
  FilterOp_Operator,
  ReadRequest
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/resource_base.js';
import {
  ProductNature,
  ProductVariant,
  ProductVariantListResponse,
  ProductVariantService
} from './ProductVariantService.js';
import {
  AccessControlledServiceBase
} from '../experimental/AccessControlledServiceBase.js'
import { createStatusCode, merge, unique } from '../utils.js';

enum VARIANT_NATURES {
  physical = 'physical',
  virtual ='virtual',
  service = 'service',
};
const VariantNatures = Object.values(VARIANT_NATURES);

enum VARIANT_TYPES {
  templates = 'templates',
  variants = 'variants'
};
const VariantTypes = Object.values(VARIANT_TYPES);

const extractVariants = (
  request: ProductList,
  delimiter = ':',
): ProductVariant[] => request.items?.filter(
  item => item?.product
).flatMap(
  item => {
    const product = item.product;
    const { physical, virtual, service } = product;
    return Object.entries({ physical, virtual, service }).flatMap(
      ([nature, n]) => {
        if (n) {
          const variants = Object.entries(n).flatMap(
            ([type, vs]: [string, ProductVariant[]]) => vs?.map(
              (v) => {
                v.id ??= randomUUID().replace('-', '');
                v.id = [item.id, nature, type, v.id].join(delimiter);
                return v;
              }
            )
          );
          delete (product as any)[nature];
          return variants;
        }
        else {
          return [];
        }
      }
    );
  }
).filter(v => v);

const filterVariants = (
  variants: ProductVariant[],
  key: string,
) => {
  return variants?.filter(
    (v, i) => v?.id?.startsWith(key)
      && delete variants[i]
  ).map(
    (v) => {
      v.id = v.id.slice(key.length);
      return v;
    }
  );
};

const assignVariants = (
  products: ProductListResponse,
  variants: ProductVariantListResponse,
  delimiter = ':',
) => {
  const root = variants?.items?.map(item => item.payload);
  for (const item of products.items ?? []) {
    const pv = filterVariants(root, item.payload.id + delimiter);
    if (pv?.length) {
      item.payload.product ??= {};
      for (const nature of VariantNatures) {
        const nv = filterVariants(pv, nature + delimiter);
        if (nv?.length) {
          item.payload.product[nature] ??= {};
          for (const type of VariantTypes) {
            const tv = filterVariants(nv, type + delimiter);
            if (tv?.length) {
              item.payload.product[nature][type] = tv;
            }
          }
        }
      }
    }
  }
  return products;
};

const initProductVariantService = (
  topic: Topic,
  db: DatabaseProvider,
  cfg: ServiceConfig,
  logger?: Logger,
  enableEvents = false,
  resourceName = 'product',
) => (
  cfg.get('defaults:ProductVariantService:disabled')?.toString() === 'true'
  ? null
  : new ProductVariantService(
    topic,
    db,
    cfg,
    logger,
    enableEvents,
    cfg.get('defaults:ProductVariantService:resourceName') ?? resourceName + '_variant',
    cfg.get('defaults:ProductVariantService:collectionName') ?? resourceName + '_variants',
  )
);

export class ProductService
  extends AccessControlledServiceBase<ProductListResponse, ProductList>
  implements ProductServiceImplementation
{
  private readonly status_codes = {
    OK: {
      code: 200,
      message: 'OK',
    },
    VARIANT_NOT_FOUND: {
      code: 404,
      message: '{entity} {id}:{entity_id} not found!',
    },
    NO_INDIVIDUAL_PRODUCT: {
      code: 400,
      message: '{entity} {id}: is no individual product!',
    },
  };

  protected readonly operation_status_codes = {
    SUCCESS: {
      code: 200,
      message: 'success',
    },
    MULTI_STATUS: {
      code: 207,
      message: 'Multi status - response may include errors!',
    },
  };

  constructor(
    topic: Topic,
    db: DatabaseProvider,
    cfg: ServiceConfig,
    logger: Logger,
    enableEvents = false,
    resourceName: string = 'product',
    collectionName: string = 'products',
    protected readonly productVariantSrv = initProductVariantService(
      topic,
      db,
      cfg,
      logger,
      false,
      resourceName,
    ),
    protected readonly delimiter: string = cfg.get('defaults:ProductVariantService:delimiter') ?? ':'
  ) {
    super(resourceName, topic, db, cfg, logger, enableEvents, collectionName);

    this.status_codes = {
      ...this.status_codes,
      ...cfg.get('statusCodes')
    };
    this.operation_status_codes = {
      ...this.operation_status_codes,
      ...cfg.get('operationStatusCodes'),
    };
  }
  claimVariant(request: IndividualProductVariantListRequest, context: CallContext): Promise<DeepPartial<IndividualProductVariantListResponse>> {
    throw new Error('Method not implemented.');
  }
  releaseVariant(request: IndividualProductVariantListRequest, context: CallContext): Promise<DeepPartial<IndividualProductVariantListResponse>> {
    throw new Error('Method not implemented.');
  }
  resolveSession(request: Session, context: CallContext): Promise<DeepPartial<IndividualProductVariantListResponse>> {
    throw new Error('Method not implemented.');
  }
  dropSession(request: Session, context: CallContext): Promise<DeepPartial<IndividualProductVariantListResponse>> {
    throw new Error('Method not implemented.');
  }

  private async findVariants(
    product_ids: string[],
    context?: CallContext,
  ) {
    if (!product_ids?.length) {
      return null;
    }
    const request = {
      filters: [{
        filters: product_ids.map(
          id => ({
            field: 'id',
            value: `${id}%`,
            operation: Filter_Operation.iLike
          })
        ),
        operator: FilterOp_Operator.or
      }],
      sorts: [{
        field: 'id',
        order: Sort_SortOrder.ASCENDING,
      }]
    };
    const result = await this.productVariantSrv.read(
      request,
      context,
    );
    return result;
  }

  private mergeVariantRecursive(
    item: Product,
    variant_id?: string,
    nature?: ProductNature,
  ): IndividualProductVariant {
    const product = item.product;
    if (!nature) {
      if (!product) {
        throw createStatusCode(
          item.id,
          'Product',
          this.status_codes.NO_INDIVIDUAL_PRODUCT,
          variant_id,
        );
      }
      nature ??= product.physical ?? product.virtual ?? product.service;
      delete product.physical;
      delete product.virtual;
      delete product.service;
    }
    const variant = nature?.templates?.find(
      v => v.id === variant_id
    ) ?? nature?.variants?.find(
      v => v.id === variant_id
    );
    if (!variant) {
      throw createStatusCode(
        item.id,
        'Variant',
        this.status_codes.VARIANT_NOT_FOUND,
        variant_id,
      );
    }
    if (variant?.parent_variant_id) {
      const template = this.mergeVariantRecursive(
        item,
        variant.parent_variant_id,
        nature,
      );
      return {
        ...product,
        ...template,
        ...variant,
        attributes: unique(
          merge(
            template.attributes,
            variant.attributes,
          )
        ),
        properties: unique(
          merge(
            template.properties,
            variant.properties,
          )
        ),
        tax_ids: [...new Set(merge(
          product.tax_ids,
          template.tax_ids,
          variant.tax_ids,
        )).values()],
        files: unique(
          merge(
            template.files,
            variant.files,
          )
        ),
        images: unique(
          merge(
            template.images,
            variant.images,
          )
        ),
        id: item.id!,
        variant_id: variant.id,
      };
    }
    else {
      return {
        ...product,
        ...variant,
        id: item.id!,
        variant_id: variant.id,
      };
    }
  };
  

  public override async superRead(
    request: ReadRequest,
    context?: CallContext,
  ): Promise<ProductListResponse> {
    if (this.productVariantSrv) {
      const product_response = await super.superRead(
        request,
        context,
      );
      const variant_response = await this.findVariants(
        product_response.items?.map(
          item => item.payload.id
        ),
        context,
      );
      return assignVariants(product_response, variant_response, this.delimiter);
    }
    else {
      return await super.superRead(
        request,
        context,
      );
    }
  }

  public override async superCreate(
    request: ProductList,
    context?: CallContext,
  ): Promise<ProductListResponse> {
    if (this.productVariantSrv) {
      const variants = extractVariants(request, this.delimiter);
      const product_response = await super.superCreate(
        request,
        context,
      );
      const variant_response = await this.productVariantSrv.create(
        {
          items: variants,
          total_count: variants.length,
          subject: request.subject,
        },
        context,
      );
      return assignVariants(product_response, variant_response, this.delimiter);
    }
    else {
      return await super.superCreate(
        request,
        context,
      );
    }
  }

  public override async superUpdate(
    request: ProductList,
    context?: CallContext,
  ): Promise<ProductListResponse> {
    if (this.productVariantSrv) {
      const variants = extractVariants(request, this.delimiter);
      const product_response = await super.superUpdate(
        request,
        context,
      );
      const variant_response = await this.productVariantSrv.update(
        {
          items: variants,
          total_count: variants.length,
          subject: request.subject,
        },
        context,
      );
      return assignVariants(product_response, variant_response, this.delimiter);
    }
    else {
      return await super.superUpdate(
        request,
        context,
      );
    }
  }

  public override async superUpsert(
    request: ProductList,
    context?: CallContext,
  ): Promise<ProductListResponse> {
    if (this.productVariantSrv) {
      const variants = extractVariants(request, this.delimiter);
      const product_response = await super.superUpsert(
        request,
        context,
      );
      const variant_response = await this.productVariantSrv.upsert(
        {
          items: variants,
          total_count: variants.length,
          subject: request.subject,
        },
        context,
      );
      return assignVariants(product_response, variant_response, this.delimiter);
    }
    else {
      return await super.superUpsert(
        request,
        context,
      );
    }
  }

  public override async superDelete(
    request: DeleteRequest,
    context?: CallContext,
  ): Promise<DeleteResponse> {
    if (this.productVariantSrv) {
      if (request.collection) {
        await this.productVariantSrv.delete(request, context);
        return await super.superDelete(request, context);
      }

      const variant_ids = await this.findVariants(
        request.ids,
        context,
      ).then(
        r => r?.items?.map(item => item.payload?.id)
      ).then(
        ids => [...new Set(ids).values()]
      );
  
      if (variant_ids?.length) {
        const response = await this.productVariantSrv.delete(
          { ids: variant_ids },
          context,
        );

        if (response.operation_status?.code !== 200) {
          return response;
        }

        request.ids = request.ids.filter(
          id => !variant_ids.includes(id)
        );
        if (request.ids?.length) {
          await super.superDelete(request, context).then(
            r => {
              response.status.push(...r.status);
              response.operation_status = r.operation_status;
            }
          );
        }

        return response;
      }
      else {
        return super.superDelete(request, context);
      }
    }
    else {
      return await super.superDelete(request, context);
    }
  }
  
  public async getVariant(
    request: IndividualProductVariantListRequest,
    context?: CallContext
  ): Promise<DeepPartial<IndividualProductVariantListResponse>> {
    const product_ids = request.items?.map(item => item.product_id);
    const products = await this.get(
      product_ids,
      request.subject,
      context,
    );
    if (this.productVariantSrv) {
      const variants = await this.findVariants(
        product_ids,
        context,
      );
      assignVariants(products, variants, this.delimiter);
    }

    const product_map = new Map<string, Product>(
      products.items.map(item => [item.payload.id, item.payload])
    );
    const items = request.items.map(
      item => {
        try {
          const payload = this.mergeVariantRecursive(
            product_map.get(item.product_id),
            item.variant_id,
          );
          return {
            payload,
            status: createStatusCode(
              item.product_id,
              'IndividualProductVariant',
              this.status_codes.OK,
              item.variant_id,
            )
          }
        }
        catch (err) {
          return this.catchStatusError(err)
        }
      }
    );

    const operation_status = (
      items?.every(item => item.status.code === 200)
      ? this.operation_status_codes.SUCCESS
      : this.operation_status_codes.MULTI_STATUS
    );
    return {
      items,
      total_count: items.length,
      operation_status
    };
  }
}