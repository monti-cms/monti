"use client";

import { type ComponentPropsWithRef, type ComponentType, createContext, type ReactNode, useContext } from "react";

/** Props of a link the admin draws. The same as an `<a>`, with a string `href` (an address inside the site, e.g. `/admin/trash`). */
export type AdminLinkProps = ComponentPropsWithRef<"a"> & {
	href: string;
	/** Whether the host may load the target ahead of a click. The host decides what that means (or ignores it). */
	prefetch?: boolean;
};

export interface AdminNavigateOptions {
	/** Whether the host scrolls to the top after the change. Default `true`. A list that only changes its query passes `false`. */
	scroll?: boolean;
}

/** The query of the current address. Reading only: the admin changes it through `navigate` and `replace`. */
export type AdminSearchParams = Omit<URLSearchParams, "append" | "delete" | "set" | "sort">;

/**
 * What the admin needs from the framework it runs in. A host package supplies it once through {@link AdminRouterProvider}
 * (`@monti-cms/nextjs` does it for the Next.js App Router), so the screens and `@monti-cms/admin/hooks` never import a framework.
 * Addresses are in-site paths; the host's own router adds what it adds (for example the app's `basePath`).
 */
export interface AdminRouter {
	/** Link to an address inside the site. A client-side navigation where the host has one. */
	Link: ComponentType<AdminLinkProps>;
	/** Goes to the address and adds a history entry. */
	navigate(href: string, options?: AdminNavigateOptions): void;
	/** Goes to the address in place of the current history entry. */
	replace(href: string, options?: AdminNavigateOptions): void;
	/** Hook: path of the current address, without the query. Re-renders when it changes. */
	usePathname(): string;
	/** Hook: query of the current address. Re-renders when it changes. */
	useSearchParams(): AdminSearchParams;
}

const AdminRouterContext = createContext<AdminRouter | null>(null);

/** Supplies the host's router to every admin screen and hook below it. */
export function AdminRouterProvider({ router, children }: { router: AdminRouter; children: ReactNode }) {
	return <AdminRouterContext.Provider value={router}>{children}</AdminRouterContext.Provider>;
}

/** The router of the host. Throws outside {@link AdminRouterProvider}, which the admin layout of a host package renders. */
export function useAdminRouter(): AdminRouter {
	const router = useContext(AdminRouterContext);
	if (!router) {
		throw new Error(
			"The admin has no router: render it inside an AdminRouterProvider (the admin layout of your framework package does).",
		);
	}
	return router;
}

/** Link to an address inside the site, drawn by the host's router. */
export function AdminLink(props: AdminLinkProps) {
	const { Link } = useAdminRouter();
	return <Link {...props} />;
}

/** Path of the current address (see {@link AdminRouter.usePathname}). */
export function useAdminPathname(): string {
	return useAdminRouter().usePathname();
}

/** Query of the current address (see {@link AdminRouter.useSearchParams}). */
export function useAdminSearchParams(): AdminSearchParams {
	return useAdminRouter().useSearchParams();
}
