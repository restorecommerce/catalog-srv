import {
  Response,
  Response_Decision,
  ReverseQuery,
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/access_control.js';
import {
  UserListResponse,
  UserResponse,
  UserType
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/user.js';
import {
  OperationStatus,
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/status.js';
import {
  Effect
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/rule.js';
import {
  Subject
} from '@restorecommerce/rc-grpc-clients/dist/generated/io/restorecommerce/auth.js';
import {
  HierarchicalScope
} from '@restorecommerce/rc-grpc-clients/dist/generated-server/io/restorecommerce/auth.js';
import {
  getRedisInstance,
  logger
} from './utils.js';

export const mainMeta = {
  modifiedBy: 'SYSTEM',
  acls: [],
  created: new Date(),
  modified: new Date(),
  owners: [
    {
      id: 'urn:restorecommerce:acs:names:ownerIndicatoryEntity',
      value: 'urn:restorecommerce:acs:model:organization.Organization',
      attributes: [
        {
          id: 'urn:restorecommerce:acs:names:ownerInstance',
          value: 'main',
          attributes: []
        }
      ]
    },
  ]
};

export const subjects = {
  root_tech_user: {
    id: "root_tech_user",
    token: "1a4c6789-6435-487a-9308-64d06384acf9"
  },
  superadmin: {
    id: 'superadmin',
    scope: 'main',
    token: 'superadmin',
  },
  admin: {
    id: 'admin',
    scope: 'sub',
    token: 'admin',
  },
};

const operationStatus: OperationStatus = {
  code: 200,
  message: 'OK',
};

export const manufacturers = [
  {
    id: 'manufacturer-1',
    name: 'Manufacturer 1',
    description: 'Manufacturer 1 Description',
    meta: mainMeta
  },
  {
    id: 'manufacturer-2',
    name: 'Manufacturer 2',
    description: 'Manufacturer 2 Description',
    meta: mainMeta
  },
];

const users: Record<string, UserResponse> = {
  root_tech_user: {
    payload: {
      id: 'root_tech_user',
      role_associations: [
        {
          id: 'root_tech_user-1-super-administrator-r-id',
          role: 'superadministrator-r-id',
          attributes: [],
        },
      ],
      active: true,
      user_type: UserType.TECHNICAL_USER,
      tokens: [
        {
          token: '1a4c6789-6435-487a-9308-64d06384acf9',
        }
      ],
    },
    status: {
      id: 'root_tech_user',
      code: 200,
      message: 'OK',
    }
  },
  superadmin: {
    payload: {
      id: 'superadmin',
      name: 'manuel.mustersuperadmin',
      first_name: 'Manuel',
      last_name: 'Mustersuperadmin',
      email: 'manuel.mustersuperadmin@restorecommerce.io',
      password: 'A$1rcadminpw',
      default_scope: 'r-ug',
      role_associations: [
        {
          id: 'superadmin-1-administrator-r-id',
          role: 'superadministrator-r-id',
          attributes: [],
        },
      ],
      locale_id: 'de-de',
      timezone_id: 'europe-berlin',
      active: true,
      user_type: UserType.ORG_USER,
      tokens: [
        {
          token: 'superadmin',
        }
      ],
      meta: mainMeta,
    },
    status: {
      id: 'superadmin',
      code: 200,
      message: 'OK',
    }
  },
  admin: {
    payload: {
      id: 'admin',
      name: 'manuel.musteradmin',
      first_name: 'Manuel',
      last_name: 'Musteradmin',
      email: 'manuel.musteradmin@restorecommerce.io',
      password: 'A$1rcadminpw',
      default_scope: 'sub',
      role_associations: [
        {
          id: 'admin-1-administrator-r-id',
          role: 'administrator-r-id',
          attributes: [
            {
              id: 'urn:restorecommerce:acs:names:roleScopingEntity',
              value: 'urn:restorecommerce:acs:model:organization.Organization',
              attributes: [
                {
                  id: 'urn:restorecommerce:acs:names:roleScopingInstance',
                  value: 'sub',
                }
              ],
            }
          ],
        },
      ],
      locale_id: 'de-de',
      timezone_id: 'europe-berlin',
      active: true,
      user_type: UserType.ORG_USER,
      tokens: [
        {
          token: 'admin',
        }
      ],
      meta: mainMeta,
    },
    status: {
      id: 'admin',
      code: 200,
      message: 'OK',
    }
  },
};

const hierarchicalScopes: Record<string, HierarchicalScope[]> = {
  root_tech_user: [
    {
      id: 'main',
      role: 'superadministrator-r-id',
      children: [
        {
          id: 'sub',
        }
      ]
    }
  ],
  superadmin: [
    {
      id: 'main',
      role: 'superadministrator-r-id',
      children: [
        {
          id: 'sub',
        }
      ]
    }
  ],
  admin: [
    {
      id: 'sub',
      role: 'administrator-r-id',
    }
  ]
};

const whatIsAllowed: ReverseQuery = {
  policySets: [
    {
      id: 'policy_set',
      combiningAlgorithm: 'urn:oasis:names:tc:xacml:3.0:rule-combining-algorithm:permit-overrides',
      effect: Effect.PERMIT,
      policies: [
        {
          id: 'policy_superadmin_permit_all',
          combiningAlgorithm: 'urn:oasis:names:tc:xacml:3.0:rule-combining-algorithm:permit-overrides',
          effect: Effect.PERMIT,
          target: {
            subjects: [
              {
                id: 'urn:restorecommerce:acs:names:role',
                value: 'superadministrator-r-id',
              },
            ],
          },
          rules: [{
            effect: Effect.PERMIT,
            target: {
              subjects: [
                {
                  id: 'urn:restorecommerce:acs:names:role',
                  value: 'superadministrator-r-id',
                },
              ],
            },
          }],
          hasRules: true,
        },{
          id: 'policy_admin_permit_all_by_scope',
          combiningAlgorithm: 'urn:oasis:names:tc:xacml:3.0:rule-combining-algorithm:permit-overrides',
          effect: Effect.PERMIT,
          target: {
            subjects: [
              {
                id: 'urn:restorecommerce:acs:names:role',
                value: 'administrator-r-id',
              },
            ],
          },
          rules: [{
            id: 'admin_can_do_all_by_scope',
            effect: Effect.PERMIT,
            target: {
              subjects: [
                {
                  id: 'urn:restorecommerce:acs:names:role',
                  value: 'administrator-r-id',
                },
                {
                  id: 'urn:restorecommerce:acs:names:roleScopingEntity',
                  value: 'urn:restorecommerce:acs:model:organization.Organization',
                },
              ],
            },
          }],
          hasRules: true
        },
      ]
    },
  ],
  operationStatus,
};

export const rules = {
  'acs-srv': {
    isAllowed: (
      call: any,
      callback: (error: any, response: Response) => void,
    ) => callback(null, {
      decision: Response_Decision.PERMIT,
    }),
    whatIsAllowed: (
      call: any,
      callback: (error: any, response: ReverseQuery) => void,
    ) => callback(null, whatIsAllowed),
  },
  user: {
    read: (
      call: any,
      callback: (error: any, response: UserListResponse) => void,
    ) => callback(null, {}),
    findByToken: (
      call: any,
      callback: (error: any, response: UserResponse) => void,
    ) => {
      getRedisInstance().then(
        async client => {
          const subject = users[call.request.token];
          await client.set(
            `cache:${ subject.payload?.id }:subject`,
            JSON.stringify(subject.payload),
          );
          await client.set(
            `cache:${ subject.payload?.id }:hrScopes`,
            JSON.stringify(hierarchicalScopes[call.request.token]),
          );
          return subject;
        },
      ).then(
        subject => callback(null, subject),
        error => logger.error(error),
      );
    }
  },
};