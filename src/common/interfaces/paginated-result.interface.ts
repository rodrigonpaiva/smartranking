export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
