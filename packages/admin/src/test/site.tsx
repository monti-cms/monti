import { SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import { type ReactElement, type ReactNode, useState } from "react";
import { testSite } from "../../../core/test/site";

/**
 * Wrapper for `render(ui, { wrapper })`: the admin components read the site with `useSite()`, which throws outside a provider, and look
 * server data up through the query cache (a fresh one per render, without retries).
 */
export const SiteWrapper = ({ children }: { children: ReactNode }) => {
	const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
	return (
		<SiteProvider site={testSite}>
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		</SiteProvider>
	);
};

/** `render` of Testing Library with the test site around the element. */
export const renderWithSite = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
	render(ui, { wrapper: SiteWrapper, ...options });
