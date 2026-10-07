import { SiteProvider } from "@monti-cms/core/client";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { testSite } from "../../../core/test/site";

/** Wrapper for `render(ui, { wrapper })`: the admin components read the site with `useSite()`, which throws outside a provider. */
export const SiteWrapper = ({ children }: { children: ReactNode }) => (
	<SiteProvider site={testSite}>{children}</SiteProvider>
);

/** `render` of Testing Library with the test site around the element. */
export const renderWithSite = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
	render(ui, { wrapper: SiteWrapper, ...options });
