import { withBasePath } from "../../core/base-path.js";
import { createActiveTranslator } from "../../i18n/active.js";
import { CMS_AUTH_BASE_PATH } from "../../server/define.js";
import { isAllowedAdminId, isDevAuthBypassEnabled } from "./auth-gateway.js";
import { authMessages } from "./messages.js";
/** The UI locale is picked when text is read. Used instead of `i18n`, which reads the site config, so that `cms.server.ts` does not pull in the config. */
const t = createActiveTranslator(authMessages);
/**
 * GitHub OAuth (NextAuth) admin login. NextAuth is loaded the first time login is used
 * (so code that only uses the store, and command-line tools, do not read next-auth).
 */
export function githubAuth(options) {
    return {
        name: "github",
        create: ({ loginPath }) => {
            const basePath = (options.basePath ?? CMS_AUTH_BASE_PATH).replace(/\/$/, "");
            let nextAuth;
            const load = () => {
                nextAuth ??= import("./auth-config.js").then((module) => module.createGithubNextAuth({
                    ...options,
                    // NextAuth matches paths against the request URL the browser sees, so it includes the Next `basePath` (`CmsAuth.basePath` is the in-app path).
                    basePath: withBasePath(basePath),
                    signInPage: loginPath,
                }));
                return nextAuth;
            };
            return {
                basePath,
                handlers: {
                    GET: async (request) => (await load()).handlers.GET(request),
                    POST: async (request) => (await load()).handlers.POST(request),
                },
                session: async () => {
                    const session = await (await load()).auth();
                    if (!session)
                        return null;
                    return { user: { id: session.user?.id, accountId: session.user?.githubId } };
                },
                providers: [
                    {
                        id: "github",
                        name: "GitHub",
                        get label() {
                            return t("github.label");
                        },
                    },
                ],
                signIn: async (provider = "github", signInOptions) => (await load()).signIn(provider, signInOptions),
                signOut: async (signOutOptions) => (await load()).signOut(signOutOptions),
                isAdmin: (userId) => isAllowedAdminId(userId, options.adminIds),
                get devBypass() {
                    return isDevAuthBypassEnabled(options.devBypass);
                },
                devUserId: options.adminIds.find((id) => id?.trim())?.trim() || "local-dev",
            };
        },
    };
}
