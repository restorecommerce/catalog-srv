#!/bin/bash
docker run \
 --name catalog-srv \
 --hostname catalog-srv \
 --network=system_restorecommerce \
 -e NODE_ENV=production \
 -p 50051:50051 \
 restorecommerce/catalog-srv


