import { SiteProvider } from "@monti-cms/core/site";
import { type ComponentProps, type ReactNode, useState, useSyncExternalStore } from "react";
import { testSite } from "../../../core/test/site";
import { type AdminLinkProps, type AdminRouter, AdminRouterProvider } from "../router";
import { AdminShell } from "../screens/shared/admin-shell";
import { AdminQueryProvider } from "../screens/shared/query-provider";

/**
 * A screen in Storybook: the test site, a router that keeps the address in memory, and server answers from `api` instead of a server.
 * `api` gets the request's path with its query and its method; it returns the JSON body, an `{ status, body }` error, or `"pending"` to stay loading.
 */
export type FakeApi = (path: string, method: string) => unknown | { status: number; body?: unknown } | "pending";

export const answer = (status: number, body: unknown = { error: { message: "Server error" } }) => ({
	__status: status,
	body,
});

function installFetch(api: FakeApi) {
	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const path = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
		const result = api(path, init?.method ?? "GET");
		if (result === "pending") return new Promise<Response>(() => {});
		const failed = typeof result === "object" && result !== null && "__status" in result;
		const status = failed ? (result as { __status: number }).__status : 200;
		const body = failed ? (result as unknown as { body: unknown }).body : (result ?? {});
		return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	};
}

function memoryRouter(search: string): AdminRouter {
	const listeners = new Set<() => void>();
	const state = { pathname: "/admin", search: new URLSearchParams(search) };
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	const apply = (href: string) => {
		const [path = "", query = ""] = href.split("?");
		if (path) state.pathname = path;
		state.search = new URLSearchParams(query);
		for (const listener of listeners) listener();
	};
	return {
		Link: ({ prefetch: _prefetch, ...props }: AdminLinkProps) => <a {...props} />,
		navigate: apply,
		replace: apply,
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
}

export function ScreenFrame({
	api,
	title,
	nav,
	search = "",
	children,
}: {
	api: FakeApi;
	title: string;
	nav: NonNullable<ComponentProps<typeof AdminShell>["sidebar"]>["activeNav"];
	search?: string;
	children: ReactNode;
}) {
	// Set up once per story, before the screen's first request.
	const [router] = useState(() => {
		installFetch(api);
		return memoryRouter(search);
	});
	return (
		<SiteProvider site={testSite}>
			<AdminRouterProvider router={router}>
				<AdminQueryProvider>
					<AdminShell title={title} sidebar={{ activeNav: nav }}>
						{children}
					</AdminShell>
				</AdminQueryProvider>
			</AdminRouterProvider>
		</SiteProvider>
	);
}
