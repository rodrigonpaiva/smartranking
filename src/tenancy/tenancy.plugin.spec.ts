import type { Query } from 'mongoose';
import { tenancyContext } from './tenancy.context';
import { tenancyTestUtils } from './tenancy.plugin';

class FakeQuery implements Partial<Query<unknown, unknown>> {
  private readonly filter: Record<string, unknown> = {};
  private readonly options: Record<string, unknown> = {};
  private readonly ors: Array<Record<string, unknown>[]> = [];

  getQuery(): Record<string, unknown> {
    return this.filter;
  }

  getOptions(): Record<string, unknown> {
    return this.options;
  }

  setOption(key: string, value: unknown): void {
    this.options[key] = value;
  }

  where(field: string) {
    return {
      equals: (value: unknown) => {
        this.filter[field] = value;
      },
    };
  }

  or(criteria: Record<string, unknown>[]): this {
    this.ors.push(criteria);
    return this;
  }

  getOrs(): Array<Record<string, unknown>[]> {
    return this.ors;
  }
}

describe('tenancy plugin helpers', () => {
  const { applyTenantCriteria } = tenancyTestUtils;

  it('sets tenant filter by default', () => {
    const query = new FakeQuery();
    tenancyContext.run(
      {
        tenant: 'tenant-a',
        allowMissingTenant: false,
        disableTenancy: false,
      },
      () => {
        applyTenantCriteria(query as Query<unknown, unknown>, 'tenant');
      },
    );

    expect(query.getQuery().tenant).toBe('tenant-a');
  });

  it('allows documents without tenant for admins', () => {
    const query = new FakeQuery();
    tenancyContext.run(
      {
        tenant: 'tenant-admin',
        allowMissingTenant: true,
        disableTenancy: false,
      },
      () => {
        applyTenantCriteria(query as Query<unknown, unknown>, 'tenant');
      },
    );

    expect(query.getOrs()).toHaveLength(1);
    expect(query.getOrs()[0]).toEqual([
      { tenant: 'tenant-admin' },
      { tenant: { $exists: false } },
      { tenant: null },
    ]);
  });

  it('skips injection when tenancy is disabled', () => {
    const query = new FakeQuery();
    tenancyContext.run(
      {
        tenant: 'tenant-a',
        allowMissingTenant: false,
        disableTenancy: true,
      },
      () => {
        applyTenantCriteria(query as Query<unknown, unknown>, 'tenant');
      },
    );

    expect(query.getQuery().tenant).toBeUndefined();
  });

  it('does not override existing tenant filters', () => {
    const query = new FakeQuery();
    query.where('tenant').equals('custom');
    tenancyContext.run(
      {
        tenant: 'tenant-a',
        allowMissingTenant: false,
        disableTenancy: false,
      },
      () => {
        applyTenantCriteria(query as Query<unknown, unknown>, 'tenant');
      },
    );

    expect(query.getQuery().tenant).toBe('custom');
  });
});
