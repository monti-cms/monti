import { jsx as _jsx } from "react/jsx-runtime";
/** Fixed origin used only when resolving path-form links. */
const SITE_PATH_BASE = "https://anchor.invalid";
/**
 * Lets only site-relative paths through. The WHATWG URL parser treats `\` as `/`, so `/\evil.example` becomes a different origin;
 * it is resolved against a fixed origin and accepted as a path only when the origin is the same.
 */
export function resolveSitePath(value) {
    if (!value.startsWith("/"))
        return null;
    const resolved = new URL(value, SITE_PATH_BASE);
    return resolved.origin === SITE_PATH_BASE ? `${resolved.pathname}${resolved.search}${resolved.hash}` : null;
}
/**
 * Body link. Only `#`, site-relative paths and http(s) become links (`javascript:`, `data:` and `//host` stay as text),
 * and outside links open in a new window (`cms-link-external`).
 */
export function CmsLink({ children, href, className, ...props }) {
    const h = typeof href === "string" ? href : "";
    const siteHref = h.startsWith("#") ? h : resolveSitePath(h);
    const isExternal = /^https?:\/\//.test(h);
    if (!siteHref && !isExternal) {
        return (_jsx("a", { ...props, className: className, children: children }));
    }
    if (siteHref) {
        return (_jsx("a", { href: siteHref, ...props, className: className, children: children }));
    }
    return (_jsx("a", { href: h, ...props, className: ["cms-link-external", className].filter(Boolean).join(" "), target: props.target ?? "_blank", rel: props.rel ?? "noreferrer noopener", children: children }));
}
