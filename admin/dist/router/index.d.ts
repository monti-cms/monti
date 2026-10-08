import { type ComponentPropsWithRef, type ComponentType, type ReactNode } from "react";
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
/** Supplies the host's router to every admin screen and hook below it. */
export declare function AdminRouterProvider({ router, children }: {
    router: AdminRouter;
    children: ReactNode;
}): import("react").JSX.Element;
/** The router of the host. Throws outside {@link AdminRouterProvider}, which the admin layout of a host package renders. */
export declare function useAdminRouter(): AdminRouter;
/** Link to an address inside the site, drawn by the host's router. */
export declare function AdminLink(props: AdminLinkProps): import("react").JSX.Element;
/** Path of the current address (see {@link AdminRouter.usePathname}). */
export declare function useAdminPathname(): string;
/** Query of the current address (see {@link AdminRouter.useSearchParams}). */
export declare function useAdminSearchParams(): AdminSearchParams;
