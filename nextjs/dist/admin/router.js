"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { AdminRouterProvider } from "@monti-cms/admin/router";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
/** The admin's link on Next's `Link`: client-side navigation with prefetching, for an address inside the site. */
function Link({ href, ...props }) {
    return _jsx(NextLink, { ...props, href: href });
}
/**
 * The App Router adapter of the admin: gives `@monti-cms/admin` a `Link`, `navigate`, `replace`, `usePathname` and `useSearchParams`
 * built on `next/link` and `next/navigation`, so the admin itself imports nothing from Next.
 * `CmsAdminLayout` renders it; a site that mounts the admin screens some other way wraps them in it.
 */
export function NextAdminRouter({ children }) {
    const router = useRouter();
    const adapter = useMemo(() => ({
        Link,
        navigate: (href, options) => router.push(href, options),
        replace: (href, options) => router.replace(href, options),
        usePathname,
        useSearchParams,
    }), [router]);
    return _jsx(AdminRouterProvider, { router: adapter, children: children });
}
