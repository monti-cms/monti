import { hostOf } from "@monti-cms/core/internal/host";
import type { Cms } from "@monti-cms/core/server";
import { adminApiUrl } from "@monti-cms/core/site";
import spec from "@monti-cms/ui/screens/login.spec.json";
import { ScreenSpec, type ScreenSpecDocument } from "@monti-cms/ui/spec";
import type { AdminServer } from "../../host/server";
import { loginState } from "./login-state";
import type { LoginButton, LoginError, LoginMode } from "./login-view";
import { loginMessages } from "./messages";

/** The `error` of the address, as the screen tells it: Auth.js's `CredentialsSignin`, or a reason from the first-admin route. */
const ERRORS: Record<string, LoginError> = {
	CredentialsSignin: "credentials",
	confirm: "confirm",
	email: "email",
	password: "password",
};

/**
 * Reads the session and the login methods and hands the screen what to show (`LoginView` draws it).
 * Sign in and out are plain form posts to the core API (its `v1/session/*` routes), not server actions: a server action cannot carry the
 * CMS instance, because the values it closes over must be serializable.
 */
export default async function AdminLoginPage({
	cms,
	server,
	searchParams,
}: {
	cms: Cms;
	server: AdminServer;
	/** The query of the address: `error` says why the last attempt did not work (Auth.js's `CredentialsSignin`, or a reason from the first-admin route). */
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { site } = cms;
	const t = site.createTranslator(loginMessages);
	if (await hostOf(cms).authGateway.isDevBypassActive()) {
		server.redirect(site.adminHref());
	}

	const auth = cms.auth();
	const session = await auth.session();
	const accountId = session?.user?.accountId;

	// If already signed in as admin, go straight to the dashboard.
	if (accountId && auth.isAdmin(accountId)) {
		server.redirect(site.adminHref());
	}

	const providers = auth.providers;
	const rawError = (await searchParams)?.error;
	const code = Array.isArray(rawError) ? rawError[0] : rawError;
	const error = code ? (ERRORS[code] ?? "other") : undefined;
	const accounts = auth.accounts;
	// The built-in login with no account yet: the first admin is created here. The route that handles the form checks that again on the server.
	const firstAdmin = Boolean(accounts) && !(await accounts?.hasAny());
	const signInAction = (id: string) => adminApiUrl(`/v1/session/sign-in/${encodeURIComponent(id)}`);
	const passwordMethod = providers.find((candidate) => candidate.credentials);

	const mode: LoginMode =
		accountId && !auth.isAdmin(accountId)
			? {
					kind: "sign-in",
					buttons: buttonsOf(providers, signInAction),
					...(passwordMethod ? { passwordAction: signInAction(passwordMethod.id) } : {}),
					denied: { name: session?.user?.name || accountId, signOutAction: adminApiUrl("/v1/session/sign-out") },
				}
			: firstAdmin
				? {
						kind: "first-admin",
						action: adminApiUrl("/v1/session/first-admin"),
						minPasswordLength: accounts?.minPasswordLength ?? 0,
						...(error ? { error } : {}),
					}
				: providers.length === 0
					? { kind: "no-login" }
					: code === "closed"
						? { kind: "closed", signInHref: site.adminHref("/login") }
						: {
								kind: "sign-in",
								buttons: buttonsOf(providers, signInAction),
								...(passwordMethod ? { passwordAction: signInAction(passwordMethod.id) } : {}),
								...(error ? { error } : {}),
							};

	// The look is `login.spec.json` drawn with the design system's parts; this page says only what it shows and where its forms post.
	const state = loginState(t, { siteName: site.config.site?.name?.trim() || "Monti", mode });
	return <ScreenSpec spec={spec as ScreenSpecDocument} state={state} />;
}

/** The login methods that are one button each (every method but the email and password form). */
const buttonsOf = (
	providers: ReturnType<Cms["auth"]>["providers"],
	signInAction: (id: string) => string,
): LoginButton[] =>
	providers
		.filter((candidate) => !candidate.credentials)
		.map((candidate) => ({
			id: candidate.id,
			name: candidate.name,
			action: signInAction(candidate.id),
			...(candidate.icon ? { icon: candidate.icon } : {}),
		}));
