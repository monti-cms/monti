import { SiteProvider } from "@monti-cms/core/client";
import { type RenderOptions, render as renderInto } from "@testing-library/react";
import { type ReactElement, type ReactNode, useSyncExternalStore } from "react";
import { vi } from "vitest";
import { testSite } from "../../../core/test/site";
import { type AdminLinkProps, type AdminRouter, AdminRouterProvider } from "../router";

/**
 * A router for tests: links are plain anchors, `navigate` only records the call, and `replace` records it and also applies its query to
 * `useSearchParams()` (what a real router does), so a screen that keeps state in the address can be driven without a framework.
 */
export function createTestRouter({ pathname = "/admin", search = "" }: { pathname?: string; search?: string } = {}) {
	const listeners = new Set<() => void>();
	const state = { pathname, search: new URLSearchParams(search) };
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	const notify = () => {
		for (const listener of listeners) listener();
	};
	const apply = (href: string) => {
		const [path = "", query = ""] = href.split("?");
		if (path) state.pathname = path;
		state.search = new URLSearchParams(query);
		notify();
	};

	const navigate = vi.fn<AdminRouter["navigate"]>();
	const replace = vi.fn<AdminRouter["replace"]>((href) => apply(href));
	const router: AdminRouter = {
		Link: ({ prefetch: _prefetch, ...props }: AdminLinkProps) => <a {...props} />,
		navigate,
		replace,
		usePathname: () =>
			useSyncExternalStore(
				subscribe,
				() => state.pathname,
				() => state.pathname,
			),
		useSearchParams: () =>
			useSyncExternalStore(
				subscribe,
				() => state.search,
				() => state.search,
			),
	};

	const Wrapper = ({ children }: { children: ReactNode }) => (
		<SiteProvider site={testSite}>
			<AdminRouterProvider router={router}>{children}</AdminRouterProvider>
		</SiteProvider>
	);

	return {
		router,
		navigate,
		replace,
		/** The query of the current address. */
		get search() {
			return state.search;
		},
		/** Sets the query of the current address, as if the user (or another tab of the app) changed it. */
		setSearch(query: string) {
			state.search = new URLSearchParams(query);
			notify();
		},
		/** Wrapper for `render(ui, { wrapper })`. */
		Wrapper,
		/** `render` of Testing Library with this router around the element. */
		render: (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
			renderInto(ui, { wrapper: Wrapper, ...options }),
	};
}

/** `render` of Testing Library inside a test router of its own. For a test that needs no control over the address. */
export const renderInRouter = createTestRouter().render;
