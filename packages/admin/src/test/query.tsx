import { SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { testSite } from "../../../core/test/site";

/** Renders a screen that uses the server data cache (react-query). Each test gets a fresh cache. */
export function renderWithQuery(ui: ReactElement) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<SiteProvider site={testSite}>
			<QueryClientProvider client={client}>{ui}</QueryClientProvider>
		</SiteProvider>,
	);
}
