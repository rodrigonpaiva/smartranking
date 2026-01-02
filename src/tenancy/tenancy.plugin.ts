import { Query, Schema } from 'mongoose';
import { tenancyContext } from './tenancy.context';

interface TenancyPluginOptions {
  tenantField?: string;
}

const DEFAULT_TENANT_FIELD = 'tenant';
type TenantMatch =
  | null
  | Record<string, unknown>
  | { $or: Record<string, unknown>[] };

const isOrMatch = (
  match: TenantMatch,
): match is { $or: Record<string, unknown>[] } => {
  return Boolean(match && (match as { $or?: unknown }).$or);
};

const shouldSkipTenancy = (query?: Query<unknown, unknown>): boolean => {
  const scope = tenancyContext.get();
  if (scope?.disableTenancy) return true;
  if (!query) return false;
  const options = query.getOptions?.() ?? {};
  return Boolean(options.disableTenancy);
};

const buildTenantMatch = (
  scope: ReturnType<typeof tenancyContext.get>,
  tenantField: string,
): TenantMatch => {
  if (!scope?.tenant) {
    return null;
  }
  if (scope.allowMissingTenant) {
    return {
      $or: [
        { [tenantField]: scope.tenant },
        { [tenantField]: { $exists: false } },
        { [tenantField]: null },
      ],
    };
  }
  return { [tenantField]: scope.tenant };
};

const applyTenantCriteria = (
  query: Query<unknown, unknown>,
  tenantField: string,
): void => {
  if (shouldSkipTenancy(query)) return;
  const scope = tenancyContext.get();
  const match = buildTenantMatch(scope, tenantField);
  if (!match) return;

  const currentQuery = query.getQuery();
  if (currentQuery?.[tenantField]) return;

  if (isOrMatch(match)) {
    query.or(match.$or);
    return;
  }

  query.where(tenantField).equals(scope?.tenant as string);
};

const TENANT_IMMUTABLE_ERROR = 'Tenant field is immutable';

const enforceTenantPath = (schema: Schema, tenantField: string): void => {
  if (!schema.path(tenantField)) {
    schema.add({
      [tenantField]: {
        type: String,
        required: true,
        immutable: true,
        index: true,
      },
    });
    return;
  }

  const path = schema.path(tenantField);
  if (path) {
    const options = (path.options = path.options ?? {});
    options.immutable = true;
    if (options.required === undefined) {
      options.required = true;
    }
  }
};

const preventTenantMutation = (
  query: Query<unknown, unknown> & {
    getUpdate?: () => Record<string, unknown> | undefined;
  },
  tenantField: string,
): void => {
  const scope = tenancyContext.get();
  if (!scope?.tenant) return;
  const update = query.getUpdate?.() as
    | (Record<string, unknown> & {
        $setOnInsert?: Record<string, unknown>;
      })
    | undefined;
  if (!update) return;

  const options = query.getOptions?.() ?? {};
  const containsTenantField = (payload: Record<string, unknown>): boolean => {
    if (tenantField in payload) {
      return true;
    }
    return Object.keys(payload).some((key) => {
      if (!key.startsWith('$')) return false;
      const value = payload[key];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        tenantField in (value as Record<string, unknown>)
      ) {
        return true;
      }
      return false;
    });
  };

  if (containsTenantField(update)) {
    throw new Error(TENANT_IMMUTABLE_ERROR);
  }

  if (options.upsert && scope.tenant) {
    if (!update.$setOnInsert) {
      update.$setOnInsert = {};
    }
    const setOnInsert = update.$setOnInsert;
    if (setOnInsert[tenantField] && setOnInsert[tenantField] !== scope.tenant) {
      throw new Error(TENANT_IMMUTABLE_ERROR);
    }
    if (!setOnInsert[tenantField]) {
      setOnInsert[tenantField] = scope.tenant;
    }
  }
};

export const tenancyPlugin = (
  schema: Schema,
  options: TenancyPluginOptions = {},
): void => {
  const tenantField = options.tenantField ?? DEFAULT_TENANT_FIELD;
  enforceTenantPath(schema, tenantField);

  const tenantAwareQueries = [
    'find',
    'findOne',
    'countDocuments',
    'findOneAndUpdate',
    'findOneAndReplace',
    'findOneAndDelete',
    'findOneAndRemove',
    'updateOne',
    'updateMany',
    'replaceOne',
    'deleteOne',
    'deleteMany',
  ] as const;

  tenantAwareQueries.forEach((hook) => {
    schema.pre(hook as never, function () {
      const query = this as unknown as Query<unknown, unknown>;
      applyTenantCriteria(query, tenantField);
    });
  });

  const mutationHooks = [
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndUpdate',
    'findOneAndReplace',
  ] as const;

  mutationHooks.forEach((hook) => {
    schema.pre(hook as never, function () {
      const query = this as unknown as Query<unknown, unknown> & {
        getUpdate?: () => Record<string, unknown> | undefined;
      };
      preventTenantMutation(query, tenantField);
    });
  });

  schema.pre(
    'save',
    function (
      this: {
        get: (field: string) => unknown;
        set: (field: string, value: unknown) => void;
        isModified?: (field: string) => boolean;
      },
      next: (err?: Error) => void,
    ) {
      if (shouldSkipTenancy()) {
        next();
        return;
      }
      const scope = tenancyContext.get();
      if (!scope?.tenant) {
        next();
        return;
      }
      const currentTenant = this.get(tenantField);
      if (currentTenant && currentTenant !== scope.tenant) {
        next(new Error(TENANT_IMMUTABLE_ERROR));
        return;
      }
      if (!currentTenant) {
        this.set(tenantField, scope.tenant);
      }
      next();
    },
  );

  const insertManyHook = function (...args: unknown[]): void {
    const docs = args.find(Array.isArray) as
      | Array<Record<string, unknown>>
      | undefined;
    const next =
      (args.find((arg) => typeof arg === 'function') as
        | ((err?: Error) => void)
        | undefined) ?? (() => undefined);

    if (shouldSkipTenancy()) {
      next();
      return;
    }
    const scope = tenancyContext.get();
    if (!scope?.tenant) {
      next();
      return;
    }
    (docs ?? []).forEach((doc) => {
      if (doc[tenantField] && doc[tenantField] !== scope.tenant) {
        throw new Error(TENANT_IMMUTABLE_ERROR);
      }
      if (!doc[tenantField]) {
        doc[tenantField] = scope.tenant;
      }
    });
    next();
  };
  // Mongoose's TypeScript overloads do not expose the insertMany signature, so
  // we cast locally to keep the runtime hook unchanged.
  schema.pre('insertMany', insertManyHook as unknown as () => void);

  schema.pre('aggregate', function () {
    if (shouldSkipTenancy()) return;
    const scope = tenancyContext.get();
    const match = buildTenantMatch(scope, tenantField);
    if (!match) return;
    const pipeline = this.pipeline() as Array<{
      $match?: Record<string, unknown>;
    }>;

    if (isOrMatch(match)) {
      if (pipeline.length === 0 || !pipeline[0].$match) {
        pipeline.unshift({ $match: { $or: match.$or } });
      } else {
        pipeline[0].$match = {
          $and: [{ $or: match.$or }, pipeline[0].$match],
        };
      }
      return;
    }

    if (pipeline.length === 0 || !pipeline[0].$match) {
      pipeline.unshift({ $match: match });
      return;
    }

    pipeline[0].$match = {
      ...match,
      ...pipeline[0].$match,
    };
  });
};

export const tenancyTestUtils = {
  applyTenantCriteria,
  buildTenantMatch,
};
