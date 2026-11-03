import { hostOf } from "@monti-cms/core/internal/host";
import type { Cms } from "@monti-cms/core/server";
import { adminApiUrl } from "@monti-cms/core/site";
import { ScreenSpec, type ScreenSpecDocument } from "@monti-cms/ui/spec";
import type { AdminServer } from "../../host/server";
import spec from "./login.screen.json";
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
 * Reads the session and the login methods and hands the screen what to show. The first sign-in screen (no error, at most one button) is drawn from
 * `login.screen.json`, a pilot of screens written as data; every other state is still drawn by `LoginView`.
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

	const siteName = site.config.site?.name?.trim() || "Monti";
	if (mode.kind === "sign-in" && !mode.error && !mode.denied && !mode.locked && mode.buttons.length <= 1) {
		const [button] = mode.buttons;
		return (
			<ScreenSpec
				// A JSON import types its numbers as `number`; `ScreenSpec` checks the spec against the catalog before it draws.
				spec={spec as ScreenSpecDocument}
				data={{
					siteName,
					password: Boolean(mode.passwordAction),
					both: Boolean(mode.passwordAction && button),
					github: button && {
						name: button.name,
						icon: button.icon,
						variant: mode.passwordAction ? "secondary" : "primary",
					},
				}}
				text={(key, params) => (key in loginMessages.messages.en ? t(key as LoginKey, params) : undefined)}
				actions={{
					...(mode.passwordAction ? { password: mode.passwordAction } : {}),
					...(button ? { github: button.action } : {}),
				}}
			/>
		);
	}
	return <LoginView t={t} siteName={siteName} mode={mode} />;
}

type LoginKey = keyof typeof loginMessages.messages.en;

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
