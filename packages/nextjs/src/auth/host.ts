import type { AuthHost } from "@monti-cms/auth";

/**
 * Headers of the request being handled, or `null` outside a request (a command-line tool, or a module loaded at build time).
 * Read from `next/headers` when asked, so the module is not loaded by code that never handles a request.
 *
 * It waits for the request (`connection()`) first. Whoever asks for the headers reads the session next, and the login makes random values for its
 * cookies; under Cache Components a random value is only allowed after `connection()`, while `headers()` alone is also allowed earlier, when Next
 * prerenders a page with the request's headers. Next's own signals (a page that has to wait for the request) are thrown on, not read as "no request".
 *
 * There is no `rethrow`: the login answers with a `Response` (a redirect that carries the cookies) and never leaves the handler by throwing,
 * which is why NextAuth needed Next's redirect signal and this does not.
 */
export const nextHost: AuthHost = {
	requestHeaders: async () => {
		const next = await Promise.all([import("next/headers"), import("next/server"), import("next/navigation")]).catch(
			() => null,
		);
		if (!next) return null;
		const [{ headers }, { connection }, { unstable_rethrow }] = next;
		try {
			await connection();
			return await headers();
		} catch (error) {
			unstable_rethrow(error);
			return null;
		}
	},
};
