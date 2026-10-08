/**
 * Headers of the request being handled, or `null` outside a request (a command-line tool, or a module loaded at build time).
 * Read from `next/headers` when asked, so the module is not loaded by code that never handles a request.
 *
 * There is no `rethrow`: the login answers with a `Response` (a redirect that carries the cookies) and never leaves the handler by throwing,
 * which is why NextAuth needed Next's redirect signal and this does not.
 */
export const nextHost = {
    requestHeaders: async () => {
        try {
            const { headers } = await import("next/headers");
            return await headers();
        }
        catch {
            return null;
        }
    },
};
