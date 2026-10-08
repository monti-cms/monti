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
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEMES = new Set(["mailto:", "tel:"]);
/**
 * Tells whether a link target other than `#`, a site path or http(s) is safe to keep: `mailto:`, `tel:` and relative references (`./x`, `../x`, `x/y`, `?q`).
 * Browsers drop tabs, line breaks and control characters (and surrounding spaces) from a URL before reading its scheme (`java\tscript:`),
 * so the check runs on the value with all of them removed. Any other scheme (`javascript:`, `vbscript:`, `data:`) and network-path forms (`//host`, `\\host`) are refused.
 */
function isSafeOtherHref(value) {
    const compact = value.replace(/[\s\p{Cc}]/gu, "");
    if (compact.length === 0)
        return false;
    const scheme = SCHEME.exec(compact)?.[0];
    if (scheme)
        return SAFE_SCHEMES.has(scheme.toLowerCase());
    return !/^(?:[\\/]{2}|\/\\|\\)/.test(compact);
}
/**
 * Body link. `#`, site-relative paths, http(s), `mailto:`, `tel:` and relative paths become links (`javascript:`, `data:` and `//host` stay as text),
 * and outside links open in a new window (`cms-link-external`).
 */
export function CmsLink({ children, href, className, ...props }) {
    const h = typeof href === "string" ? href : "";
    const siteHref = h.startsWith("#") ? h : resolveSitePath(h);
    const isExternal = /^https?:\/\//.test(h);
    if (!siteHref && !isExternal) {
        if (isSafeOtherHref(h)) {
            return (_jsx("a", { href: h, ...props, className: className, children: children }));
        }
        return (_jsx("a", { ...props, className: className, children: children }));
    }
    if (siteHref) {
        return (_jsx("a", { href: siteHref, ...props, className: className, children: children }));
    }
    return (_jsx("a", { href: h, ...props, className: ["cms-link-external", className].filter(Boolean).join(" "), target: props.target ?? "_blank", rel: props.rel ?? "noreferrer noopener", children: children }));
}
