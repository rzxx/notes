export const QUERY_STALE_TIME_MS = 30_000;
export const QUERY_RETRY_COUNT = 2;
export const QUERY_RETRY_DELAY_MS = 1_000;
export const FETCH_TIMEOUT_MS = 20_000;

export const defaultQueryOptions = {
  staleTime: QUERY_STALE_TIME_MS,
  retry: QUERY_RETRY_COUNT,
  retryDelay: QUERY_RETRY_DELAY_MS,
  refetchOnWindowFocus: false,
};
