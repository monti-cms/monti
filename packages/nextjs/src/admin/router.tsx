"use client";

import { type AdminLinkProps, type AdminRouter, AdminRouterProvider } from "@monti-cms/admin/router";
import type { Route } from "next";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo } from "react";

/** The admin's link on Next's `Link`: client-side navigation with prefetching, for an address inside the site. */
function Link({ href, ...props }: AdminLinkProps) {
	return <NextLink {...props} href={href as Route} />;
}

/**
 * The App Router adapter of the admin: gives `@monti-cms/admin` a `Link`, `navigate`, `replace`, `usePathname` and `useSearchParams`
 * built on `next/link` and `next/navigation`, so the admin itself imports nothing from Next.
 * `CmsAdminLayout` renders it; a site that mounts the admin screens some other way wraps them in it.
 */
export function NextAdminRouter({ children }: { children: ReactNode }) {
	const router = useRouter();
	const adapter = useMemo<AdminRouter>(
		() => ({
			Link,
			navigate: (href, options) => router.push(href as Route, options),
			replace: (href, options) => router.replace(href as Route, options),
			usePathname,
			useSearchParams,
		}),
		[router],
	);
	return <AdminRouterProvider router={adapter}>{children}</AdminRouterProvider>;
}
