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

export const tenancyPlugin = (
  schema: Schema,
  options: TenancyPluginOptions = {},
): void => {
  const tenantField = options.tenantField ?? DEFAULT_TENANT_FIELD;

  if (!schema.path(tenantField)) {
    schema.add({
      [tenantField]: { type: String, index: true },
    });
  }

  const queryMiddleware = [
    'find',
    'findOne',
    'countDocuments',
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
  ] as const;

  queryMiddleware.forEach((hook) => {
    schema.pre(hook, function () {
      applyTenantCriteria(this as Query<unknown, unknown>, tenantField);
    });
  });

  schema.pre(
    'save',
    function (this: {
      get: (field: string) => unknown;
      set: (field: string, value: unknown) => void;
    }) {
      if (shouldSkipTenancy()) return;
      const scope = tenancyContext.get();
      if (!scope?.tenant) return;
      if (!this.get(tenantField)) {
        this.set(tenantField, scope.tenant);
      }
    },
  );

  (
    schema as Schema & {
      pre: (name: string, fn: (...args: unknown[]) => void) => void;
    }
  ).pre('insertMany', function (...args: unknown[]) {
    const [next, docs] = args as [() => void, Array<Record<string, unknown>>];
    if (shouldSkipTenancy()) {
      next();
      return;
    }
    const scope = tenancyContext.get();
    if (!scope?.tenant) {
      next();
      return;
    }
    docs.forEach((doc) => {
      if (!doc[tenantField]) {
        doc[tenantField] = scope.tenant;
      }
    });
    next();
  });

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
