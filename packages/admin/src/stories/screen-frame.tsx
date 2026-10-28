import { SiteProvider } from "@monti-cms/core/site";
import { Toaster } from "@monti-cms/ui";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { testSite } from "../../../core/test/site";
import { type AdminLinkProps, type AdminRouter, AdminRouterProvider } from "../router";
import { AdminQueryProvider } from "../screens/shared/query-provider";

/**
 * A screen in Storybook: the test site, a router that keeps the address in memory, and server answers from `api` instead of a server.
 * `api` gets the request's path with its query, its method and its JSON body; it returns the JSON body, an `{ status, body }` error, or `"pending"` to stay loading.
 */
export type FakeApi = (
	path: string,
	method: string,
	body?: unknown,
) => unknown | { status: number; body?: unknown } | "pending";

export const answer = (status: number, body: unknown = { error: { message: "Server error" } }) => ({
	__status: status,
	body,
});

function installFetch(api: FakeApi) {
	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const path = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
		const result = api(path, init?.method ?? "GET", typeof init?.body === "string" ? JSON.parse(init.body) : undefined);
		if (result === "pending") return new Promise<Response>(() => {});
		const failed = typeof result === "object" && result !== null && "__status" in result;
		const status = failed ? (result as { __status: number }).__status : 200;
		const body = failed ? (result as unknown as { body: unknown }).body : (result ?? {});
		return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	};
}

function memoryRouter(pathname: string, search: string): AdminRouter {
	const listeners = new Set<() => void>();
	const state = { pathname, search: new URLSearchParams(search) };
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
		// A link to another query of the screen that is open (the editor's compare screen) is followed in memory; a link to another screen stays a plain anchor.
		Link: ({ prefetch: _prefetch, onClick, ...props }: AdminLinkProps) => (
			// biome-ignore lint/a11y/noStaticElementInteractions: it is a link; the address is in the spread props
			<a
				{...props}
				// biome-ignore lint/a11y/useValidAnchor: it is a link with an address (`props.href`) that this router follows in memory
				onClick={(event) => {
					onClick?.(event);
					if (!event.defaultPrevented && props.href.split("?")[0] === state.pathname) {
						event.preventDefault();
						apply(props.href);
					}
				}}
			/>
		),
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

/**
 * A page in Storybook without the admin frame, for a screen that draws its own (`ShellPage`, the media library). Toasts stay up until
 * dismissed, so a failure that only toasts can be looked at.
 */
export function PageFrame({
	api,
	pathname = "/admin",
	search = "",
	children,
}: {
	api: FakeApi;
	/** The admin address the screen reads (`/admin/settings/collections`). */
	pathname?: string;
	search?: string;
	children: ReactNode;
}) {
	// Set up once per story, before the screen's first request.
	const [router] = useState(() => {
		installFetch(api);
		return memoryRouter(pathname, search);
	});
	return (
		<SiteProvider site={testSite}>
			<AdminRouterProvider router={router}>
				<AdminQueryProvider>
					{children}
					<Toaster duration={Number.POSITIVE_INFINITY} />
				</AdminQueryProvider>
			</AdminRouterProvider>
		</SiteProvider>
	);
}
