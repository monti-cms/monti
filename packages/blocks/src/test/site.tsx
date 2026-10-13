import { SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { renderSite } from "./render-config";

/**
 * Gives the editor views under test the site they read their blocks, plugin options and admin language from (the blocks plugin site, `render-config.ts`),
 * and the query cache the editor looks server data up through (a fresh one per mount, without retries).
 */
export const WithSite = ({ children }: { children: ReactNode }) => {
	const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
	return (
		<SiteProvider site={renderSite}>
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		</SiteProvider>
	);
};
