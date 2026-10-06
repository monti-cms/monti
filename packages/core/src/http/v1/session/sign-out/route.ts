import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { adminUrl } from "../../../../core/admin-paths";
import { handleApiError } from "../../error-handler";
import type { RouteContext } from "../../handler";
import { validateSameOrigin } from "../../security";

/** `POST /api/cms/v1/session/sign-out`: signs out and sends the browser to the login screen. A plain form post from the login screen, with the same-origin check. */
export const POST = async (request: NextRequest, context: RouteContext) => {
	try {
		const { cms } = context;
		validateSameOrigin(request, { trustHost: cms.isHostTrusted(), form: true });
		await cms.auth().signOut({ redirectTo: adminUrl("/login") });
		return new Response(null, { status: 204 });
	} catch (error) {
		unstable_rethrow(error);
		return handleApiError(error);
	}
};
