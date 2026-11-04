import { hostOf } from "@monti-cms/core/internal/host";
import type { Cms } from "@monti-cms/core/server";
import { adminApiUrl } from "@monti-cms/core/site";
import type { AdminServer } from "../../host/server";
import { type LoginButton, type LoginError, type LoginMode, LoginView } from "./login-view";
import { loginMessages } from "./messages";

/** The `error` of the address, as the screen tells it: Auth.js's `CredentialsSignin`, or a reason from the first-admin route. */
const ERRORS: Record<string, LoginError> = {
	CredentialsSignin: "credentials",
	confirm: "confirm",
	email: "email",
	password: "password",
};

/**
 * Reads the session and the login methods and hands the screen (`LoginView`) what to show.
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
	/** The query of the address: `error` says why the last attempt did not work (Auth.js's `CredentialsSignin`, with its `code`, or a reason from the first-admin route). */
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
	const query = await searchParams;
	const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
	const code = first(query?.error);
	// Auth.js's reason for a refused password sign-in: `locked` after too many recent misses.
	const locked = code === "CredentialsSignin" && first(query?.code) === "locked";
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
						...(error ? { errors: [error] } : {}),
					}
				: providers.length === 0
					? { kind: "no-login" }
					: code === "closed"
						? { kind: "closed", signInHref: site.adminHref("/login") }
						: {
								kind: "sign-in",
								buttons: buttonsOf(providers, signInAction),
								...(passwordMethod ? { passwordAction: signInAction(passwordMethod.id) } : {}),
								...(locked ? { locked: true } : error ? { error } : {}),
							};

	const siteName = site.config.site?.name?.trim() || "Monti";
	return <LoginView t={t} siteName={siteName} mode={mode} />;
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
