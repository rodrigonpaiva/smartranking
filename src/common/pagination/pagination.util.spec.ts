import { clampPagination } from './pagination.util';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './pagination.constants';

describe('clampPagination', () => {
  it('defaults to the first page when input is missing', () => {
    const result = clampPagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(result.skip).toBe(0);
  });

  it('clamps the limit to the configured maximum', () => {
    const result = clampPagination({ page: 2, limit: MAX_PAGE_LIMIT * 10 });
    expect(result.limit).toBe(MAX_PAGE_LIMIT);
    expect(result.skip).toBe(MAX_PAGE_LIMIT);
  });

  it('prevents negative or zero page values', () => {
    const result = clampPagination({ page: -5, limit: 5 });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });
});
