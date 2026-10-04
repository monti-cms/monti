"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
/**
 * Server data cache of the admin screen. Placed in the layout so the cache survives moving between list and edit screens.
 * The list is refetched on every entry (`staleTime: 0`), but still shows the previous rows while fetching.
 */
export function AdminQueryProvider({ children }) {
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: { retry: 1, refetchOnWindowFocus: true },
        },
    }));
    return _jsx(QueryClientProvider, { client: client, children: children });
}
