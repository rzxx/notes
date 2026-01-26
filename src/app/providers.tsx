"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { defaultQueryOptions } from "@/lib/query-config";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: defaultQueryOptions,
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // On the server: always make a new client (per request)
  if (typeof window === "undefined") return makeQueryClient();
  // On the client: reuse the same client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
