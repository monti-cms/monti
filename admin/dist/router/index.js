"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const AdminRouterContext = createContext(null);
/** Supplies the host's router to every admin screen and hook below it. */
export function AdminRouterProvider({ router, children }) {
    return _jsx(AdminRouterContext.Provider, { value: router, children: children });
}
/** The router of the host. Throws outside {@link AdminRouterProvider}, which the admin layout of a host package renders. */
export function useAdminRouter() {
    const router = useContext(AdminRouterContext);
    if (!router) {
        throw new Error("The admin has no router: render it inside an AdminRouterProvider (the admin layout of your framework package does).");
    }
    return router;
}
/** Link to an address inside the site, drawn by the host's router. */
export function AdminLink(props) {
    const { Link } = useAdminRouter();
    return _jsx(Link, { ...props });
}
/** Path of the current address (see {@link AdminRouter.usePathname}). */
export function useAdminPathname() {
    return useAdminRouter().usePathname();
}
/** Query of the current address (see {@link AdminRouter.useSearchParams}). */
export function useAdminSearchParams() {
    return useAdminRouter().useSearchParams();
}
