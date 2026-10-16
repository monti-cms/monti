import { publicRoute } from "../../handler";

/** `POST /api/monti/v1/session/sign-out`: signs out and sends the browser to the login screen. A plain form post from the login screen, access `same-origin-form`. */
export const POST = publicRoute(async ({ request, cms }) => {
	const result = await cms.auth().signOut({ redirectTo: cms.site.adminUrl("/login"), request });
	return result instanceof Response ? result : new Response(null, { status: 204 });
});
