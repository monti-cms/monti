import type { CmsConfig } from "@monti-cms/core";
import { createSite, type Site, SiteProvider } from "@monti-cms/core/site";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderHookOptions, type RenderOptions, render, renderHook } from "@testing-library/react";
import { type ComponentType, type ReactElement, type ReactNode, useState } from "react";
import { testConfig, testSite } from "../../../core/test/site";

/**
 * Provides the site (`testSite` unless a test passes its own, such as a plugin's) to the element under test: the admin components read it with `useSite()`,
 * which throws outside a provider. A fresh query cache (no retries) comes with it, for the components that look server data up with `useQuery`.
 */
export function SiteWrapper({ children, site = testSite }: { children: ReactNode; site?: Site }) {
	const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
	return (
		<SiteProvider site={site}>
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		</SiteProvider>
	);
}

/** `ui` inside the site provider, for `render(withSite(ui))`. */
export const withSite = (ui: ReactElement, site?: Site) => <SiteWrapper site={site}>{ui}</SiteWrapper>;

/** `render` of Testing Library with the site around the element (`rerender` keeps it). `site` defaults to `testSite`. */
export const renderWithSite = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper"> & { site?: Site }) => {
	const { site, ...rest } = options ?? {};
	return render(ui, { wrapper: ({ children }) => <SiteWrapper site={site}>{children}</SiteWrapper>, ...rest });
};

/** `renderHook` of Testing Library with the test site around the hook; a `wrapper` of the test goes inside the site provider. */
export function renderHookWithSite<Result, Props>(
	callback: (props: Props) => Result,
	options: RenderHookOptions<Props> = {},
) {
	const Inner = options.wrapper as ComponentType<{ children: ReactNode }> | undefined;
	const wrapper = ({ children }: { children: ReactNode }) => (
		<SiteWrapper>{Inner ? <Inner>{children}</Inner> : children}</SiteWrapper>
	);
	return renderHook(callback, { ...options, wrapper });
}

/** The test site with folders switched on or off for one collection; everything else stays as configured. */
export function siteWithFolders(collection: string, enabled: boolean): Site {
	const collections = testConfig.collections as Record<string, object>;
	return createSite({
		...testConfig,
		collections: { ...collections, [collection]: { ...collections[collection], folders: enabled } },
	} as CmsConfig);
}
