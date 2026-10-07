import { HttpError, handleApiError } from "../../../error-handler";
import type { RouteContext } from "../../../handler";
import { validateSameOrigin } from "../../../security";

/**
 * `POST /api/cms/v1/session/sign-in/<method>`: starts signing in with one of the login methods (`cms.auth().providers`). The login screen submits a plain form here.
 * Needs no login (it is how one signs in), but the same-origin check applies. On success the login connection redirects the browser (to the provider, then to the admin).
 *
 * It is a route and not a server action because a server action cannot carry the CMS instance: its closed-over values must be serializable.
 */
export const POST = async (request: Request, context: RouteContext<{ provider: string }>) => {
	try {
		const { cms } = context;
		validateSameOrigin(cms, request, { form: true });
		const { provider = "" } = (await context.params) ?? {};
		const auth = cms.auth();
		if (!auth.providers.some((method) => method.id === provider)) {
			throw new HttpError(404, "not_found", "Unknown sign-in method");
		}
		const result = await auth.signIn(provider, { redirectTo: cms.site.adminUrl(), request });
		return result instanceof Response ? result : new Response(null, { status: 204 });
	} catch (error) {
		// The login connection may redirect by throwing (Next.js does); that signal must reach the host framework.
		context.cms.auth().rethrow?.(error);
		return handleApiError(error);
	}
};
