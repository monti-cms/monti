import { type ReactNode } from "react";
/**
 * The App Router adapter of the admin: gives `@monti-cms/admin` a `Link`, `navigate`, `replace`, `usePathname` and `useSearchParams`
 * built on `next/link` and `next/navigation`, so the admin itself imports nothing from Next.
 * `CmsAdminLayout` renders it; a site that mounts the admin screens some other way wraps them in it.
 */
export declare function NextAdminRouter({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
