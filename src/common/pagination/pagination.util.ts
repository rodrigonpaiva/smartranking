import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './pagination.constants';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationBounds {
  page: number;
  limit: number;
  skip: number;
}

export const clampPagination = (input: PaginationInput): PaginationBounds => {
  const normalizedPage = Number.isFinite(input.page) ? Number(input.page) : 1;
  const normalizedLimit = Number.isFinite(input.limit)
    ? Number(input.limit)
    : DEFAULT_PAGE_LIMIT;
  const safeLimit = Math.min(
    Math.max(Math.floor(normalizedLimit) || 1, 1),
    MAX_PAGE_LIMIT,
  );
  const safePage = Math.max(Math.floor(normalizedPage) || 1, 1);
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};
