import type { ComponentPropsWithRef } from "react";
/**
 * Lets only site-relative paths through. The WHATWG URL parser treats `\` as `/`, so `/\evil.example` becomes a different origin;
 * it is resolved against a fixed origin and accepted as a path only when the origin is the same.
 */
export declare function resolveSitePath(value: string): string | null;
/**
 * Body link. Only `#`, site-relative paths and http(s) become links (`javascript:`, `data:` and `//host` stay as text),
 * and outside links open in a new window (`cms-link-external`).
 */
export declare function CmsLink({ children, href, className, ...props }: ComponentPropsWithRef<"a">): import("react").JSX.Element;
