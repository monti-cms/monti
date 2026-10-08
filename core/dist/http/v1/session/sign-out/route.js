import { handleApiError } from "../../error-handler.js";
import { validateSameOrigin } from "../../security.js";
/** `POST /api/cms/v1/session/sign-out`: signs out and sends the browser to the login screen. A plain form post from the login screen, with the same-origin check. */
export const POST = async (request, context) => {
    try {
        const { cms } = context;
        validateSameOrigin(cms, request, { form: true });
        const result = await cms.auth().signOut({ redirectTo: cms.site.adminUrl("/login"), request });
        return result instanceof Response ? result : new Response(null, { status: 204 });
    }
    catch (error) {
        context.cms.auth().rethrow?.(error);
        return handleApiError(error);
    }
};
