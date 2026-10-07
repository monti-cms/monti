import { type Site, SiteProvider } from "@monti-cms/core/client";
import { type RenderHookOptions, type RenderOptions, render, renderHook } from "@testing-library/react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { testSite } from "../../../../core/test/site";

/** Provides the site (`testSite` unless a test passes its own) to a screen under test: screens read it through `useSite()`. */
export function SiteWrapper({ children, site = testSite }: { children: ReactNode; site?: Site }) {
	return <SiteProvider site={site}>{children}</SiteProvider>;
}

/** `ui` inside the site provider, for `render(withSite(ui))`. */
export const withSite = (ui: ReactElement, site?: Site) => <SiteWrapper site={site}>{ui}</SiteWrapper>;

/** `render` of Testing Library with the test site around the element (`rerender` keeps it). */
export const renderWithSite = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
	render(ui, { wrapper: SiteWrapper, ...options });

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
