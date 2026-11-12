export function parsePagination(query: any, defaultLimit = 25) {
  const page = Math.max(1, Number.parseInt(String(query?.page || '1'), 10) || 1);
  const requestedLimit = Number.parseInt(String(query?.limit || defaultLimit), 10) || defaultLimit;
  const limit = Math.min(200, Math.max(1, requestedLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function pagedResult<T>(data: T[], count: number, page: number, limit: number) {
  return {
    data,
    count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}
