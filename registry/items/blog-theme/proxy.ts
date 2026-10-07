import { blogProxy } from "@/registry/monti/blog-theme/blog-proxy";

// The status of a post address is decided here, before the page streams: a real 404 or 308 (see blog-proxy.ts). Next reads `config` from this file, so it cannot be re-exported.
export const proxy = blogProxy;

// Pages only: not Next's own files, the API or files with an extension.
export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
