import { startSession } from "../auth/session";
import { createAdminApi, SESSION_COOKIE } from "../entry/api";
import type { Monti } from "../monti";

/** The admin API as a signed-in admin sees it: every request carries a fresh session's cookie. */
export function signedInApi(monti: Monti) {
	const api = createAdminApi(monti);
	return async (request: Request) => {
		const { token } = await startSession(monti.db, "admin@monti.test", monti.now());
		const headers = new Headers(request.headers);
		headers.set("cookie", `${SESSION_COOKIE}=${token}`);
		return api(new Request(request, { headers }));
	};
}
