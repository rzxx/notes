"use client";

import * as React from "react";
import { Toast } from "@base-ui/react/toast";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { defaultQueryOptions } from "@/lib/query-config";
import { toToastMessage } from "@/lib/error-messages";
import { toastManager } from "@/lib/toast-manager";
import { NotificationToasts } from "@/components/toasts/NotificationToasts";

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        const message = toToastMessage(error);
        toastManager.add({
          title: message.title,
          description: message.description,
          data: { type: message.type ?? "default" },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = toToastMessage(error);
        toastManager.add({
          title: message.title,
          description: message.description,
          data: { type: message.type ?? "default" },
        });
      },
    }),
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
      <Toast.Provider toastManager={toastManager}>
        {children}
        <NotificationToasts />
        <ReactQueryDevtools initialIsOpen={false} />
      </Toast.Provider>
    </QueryClientProvider>
  );
}
