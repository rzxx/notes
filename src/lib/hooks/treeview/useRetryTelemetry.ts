import * as React from "react";
import { QUERY_RETRY_COUNT, QUERY_RETRY_DELAY_MS } from "@/lib/query-config";

type RetryTelemetry = {
  failureCount: number;
  retriesRemaining: number;
  totalRetries: number;
  nextRetryInMs: number | null;
};

export function useRetryTelemetry({
  fetchStatus,
  failureCount,
}: {
  fetchStatus: string;
  failureCount: number;
}): RetryTelemetry {
  const [nextRetryInMs, setNextRetryInMs] = React.useState<number | null>(null);

  const retriesRemaining = Math.max(0, QUERY_RETRY_COUNT - failureCount);

  React.useEffect(() => {
    if (fetchStatus !== "fetching" || failureCount === 0 || retriesRemaining === 0) {
      setNextRetryInMs(null);
      return;
    }

    const target = Date.now() + QUERY_RETRY_DELAY_MS;
    setNextRetryInMs(target - Date.now());

    const id = window.setInterval(() => {
      const remaining = target - Date.now();
      setNextRetryInMs(remaining > 0 ? remaining : 0);
    }, 200);

    return () => window.clearInterval(id);
  }, [failureCount, fetchStatus, retriesRemaining]);

  return {
    failureCount,
    retriesRemaining,
    totalRetries: QUERY_RETRY_COUNT,
    nextRetryInMs,
  };
}
