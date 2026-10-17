import { CmsError } from "../../error-handler.js";
import { publicRoute, readFormBody } from "../../handler.js";
const field = (form, name) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
};
/**
 * `POST /api/monti/v1/session/first-admin`: creates the first admin account of the built-in email and password login, then signs that account in. A plain form post from the
 * login screen, which shows the form only while no account exists. That is not what guards it: once any account exists the login refuses the request itself (`closed`), whatever
 * the browser sent. Access `same-origin-form`: needs no login (there is no account to log in with yet), and the router applies the same-origin check. A refusal sends the browser back to the login screen with `?error=<reason>`.
 */
export const POST = publicRoute(async ({ request, cms }) => {
    const auth = cms.auth();
    const method = auth.providers.find((provider) => provider.credentials);
    if (!auth.accounts || !method)
        throw new CmsError("This site has no email and password login", "not_found");
    const back = (error) => new Response(null, {
        status: 303,
        headers: { location: `${cms.site.adminUrl("/login")}?error=${encodeURIComponent(error)}` },
    });
    const form = await readFormBody(request);
    const email = field(form, "email");
    const password = field(form, "password");
    if (password !== field(form, "confirm"))
        return back("confirm");
    const created = await auth.accounts.createFirst({ email, password });
    if (!created.ok)
        return back(created.reason);
    const result = await auth.signIn(method.id, {
        redirectTo: cms.site.adminUrl(),
        request,
        credentials: { email, password },
    });
    return result instanceof Response ? result : new Response(null, { status: 204 });
});
