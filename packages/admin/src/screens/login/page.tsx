import { hostOf } from "@monti-cms/core/internal/host";
import type { Cms } from "@monti-cms/core/server";
import { adminApiUrl } from "@monti-cms/core/site";
import type * as React from "react";
import type { AdminServer } from "../../host/server";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { loginMessages } from "./messages";

/**
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

	const isUnauthorizedUser = Boolean(accountId && !auth.isAdmin(accountId));
	const providers = auth.providers;
	const rawError = (await searchParams)?.error;
	const error = Array.isArray(rawError) ? rawError[0] : rawError;
	const accounts = auth.accounts;
	const min = accounts?.minPasswordLength ?? 0;
	// The built-in login with no account yet: the first admin is created here. The route that handles the form checks that again on the server.
	const firstAdmin = Boolean(accounts) && !(await accounts?.hasAny());
	const errorText = error
		? ({
				CredentialsSignin: t("errorCredentials"),
				confirm: t("errorConfirm"),
				email: t("errorEmail"),
				password: t("errorPassword", { min }),
				closed: t("errorClosed"),
			}[error] ?? t("errorOther"))
		: undefined;
	const formProviders = providers.filter((candidate) => candidate.credentials);
	const buttonProviders = providers.filter((candidate) => !candidate.credentials);
	// With a single login method, use its name in the guidance text (e.g. "GitHub admin account").
	const provider = providers.length === 1 ? (providers[0]?.name ?? "") : "";

	const siteName = site.config.site?.name?.trim() || "Monti";

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
			<header className="flex flex-col items-center gap-1 text-center">
				<h1 className="text-monti-default text-monti-heading">{siteName}</h1>
				<p className="text-monti-caption text-monti-muted">{t("managedWith")}</p>
			</header>
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					{firstAdmin ? <CardTitle className="text-monti-title">{t("firstAdminTitle")}</CardTitle> : null}
					<CardDescription className="text-monti-body">
						{firstAdmin
							? t("firstAdminDescription")
							: formProviders.length > 0 && buttonProviders.length === 0
								? t("passwordDescription")
								: t("description", { provider })}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isUnauthorizedUser ? (
						<Alert variant="destructive" layout="stack" className="text-center">
							<AlertTitle className="text-monti-caption">{t("forbiddenTitle")}</AlertTitle>
							<AlertDescription className="mt-1 text-monti-caption">
								{t("forbidden", { provider, accountId: accountId ?? "" })}
							</AlertDescription>
							<form method="post" action={adminApiUrl("/v1/session/sign-out")} className="mt-3">
								<Button type="submit" variant="link" size="xs">
									{t("signOut")}
								</Button>
							</form>
						</Alert>
					) : firstAdmin ? (
						<form method="post" action={adminApiUrl("/v1/session/first-admin")} className="flex flex-col gap-4">
							{errorText ? <ErrorAlert text={errorText} /> : null}
							<TextField id="email" name="email" label={t("email")} type="email" autoComplete="email" />
							<TextField
								id="password"
								name="password"
								label={t("password")}
								type="password"
								autoComplete="new-password"
								minLength={min}
								hint={t("passwordHint", { min })}
							/>
							<TextField
								id="confirm"
								name="confirm"
								label={t("confirmPassword")}
								type="password"
								autoComplete="new-password"
								minLength={min}
							/>
							<Button type="submit" className="w-full">
								{t("createFirstAdmin")}
							</Button>
						</form>
					) : providers.length === 0 ? (
						<Alert variant="destructive" layout="stack" className="text-center">
							<AlertTitle className="text-monti-caption">{t("noLoginTitle")}</AlertTitle>
							<AlertDescription className="mt-1 text-monti-caption">{t("noLogin")}</AlertDescription>
						</Alert>
					) : (
						<div className="flex flex-col gap-4">
							{errorText ? <ErrorAlert text={errorText} /> : null}
							{formProviders.map((authProvider) => (
								<form
									key={authProvider.id}
									method="post"
									action={adminApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`)}
									className="flex flex-col gap-4"
								>
									<TextField id="email" name="email" label={t("email")} type="email" autoComplete="email" />
									<TextField
										id="password"
										name="password"
										label={t("password")}
										type="password"
										autoComplete="current-password"
									/>
									<Button type="submit" className="w-full">
										{t("signInSubmit")}
									</Button>
								</form>
							))}
							<div className="flex flex-col gap-2">
								{buttonProviders.map((authProvider) => (
									<form
										key={authProvider.id}
										method="post"
										action={adminApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`)}
									>
										<Button type="submit" className="w-full">
											{authProvider.icon ? (
												<img src={authProvider.icon} alt="" aria-hidden="true" className="size-4" />
											) : null}
											{t("signIn", { provider: authProvider.name })}
										</Button>
									</form>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function ErrorAlert({ text }: { text: string }) {
	return (
		<Alert variant="destructive" layout="stack" className="text-center">
			<AlertDescription className="text-monti-caption">{text}</AlertDescription>
		</Alert>
	);
}

/** One labelled input of the login forms. */
function TextField({
	id,
	label,
	hint,
	...props
}: { id: string; label: string; hint?: string } & Omit<React.ComponentProps<typeof Input>, "id">) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			{hint ? <p className="text-monti-caption text-monti-muted">{hint}</p> : null}
			<Input id={id} required {...props} />
		</div>
	);
}
