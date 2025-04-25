import { Status } from "@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/status.js";

export const createStatusCode = (
  id?: string,
  entity?: string,
  status?: Status,
  entity_id?: string,
  error?: string,
): Status => ({
  id,
  code: Number.isInteger(status?.code) ? status.code : 500,
  message: status?.message?.replace(
    '{error}', error ?? 'undefined'
  ).replace(
    '{entity}', entity ?? 'undefined'
  ).replace(
    '{id}', entity_id ?? 'undefined'
  ) ?? 'Unknown status',
});

export const merge = <T>(...lists: T[][]) => lists.filter(
  list => list
).flatMap(
  list => list
);

export const unique = <T extends Record<string, any>>(objs: T[], by = 'id'): T[] => [
  ...new Map<string, T>(
  objs.map(
    o => [o[by], o]
  )).values()
];