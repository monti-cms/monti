import { hostOf } from "@monti-cms/core/internal/host";
import type { Cms } from "@monti-cms/core/server";
import { adminApiUrl } from "@monti-cms/core/site";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Box,
	Button,
	Heading,
	Image,
	Input,
	Label,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import type * as React from "react";
import type { AdminServer } from "../../host/server";
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
		<Stack align="center" justify="center" gap={24} padding={16} minHeight="screen">
			<Stack as="header" align="center" gap={4}>
				<Heading as="h1" variant="heading">
					{siteName}
				</Heading>
				<Text as="p" variant="caption" tone="muted">
					{t("managedWith")}
				</Text>
			</Stack>
			<Box width="full" maxWidth="assistant">
				<Stack gap={24}>
					<Stack gap={8}>
						{firstAdmin ? (
							<Text as="div" align="center" variant="title">
								{t("firstAdminTitle")}
							</Text>
						) : null}
						<Text as="div" align="center" tone="muted">
							{firstAdmin
								? t("firstAdminDescription")
								: formProviders.length > 0 && buttonProviders.length === 0
									? t("passwordDescription")
									: t("description", { provider })}
						</Text>
					</Stack>
					<Stack gap={12}>
						{isUnauthorizedUser ? (
							<Alert tone="danger" layout="stack">
								<AlertTitle>
									<Text as="div" align="center" variant="caption">
										{t("forbiddenTitle")}
									</Text>
								</AlertTitle>
								<AlertDescription>
									<Text as="div" align="center" variant="caption">
										{t("forbidden", { provider, accountId: accountId ?? "" })}
									</Text>
								</AlertDescription>
								<form method="post" action={adminApiUrl("/v1/session/sign-out")}>
									<Box paddingTop={12}>
										<TextButton type="submit" variant="underline">
											{t("signOut")}
										</TextButton>
									</Box>
								</form>
							</Alert>
						) : firstAdmin ? (
							<form method="post" action={adminApiUrl("/v1/session/first-admin")}>
								<Stack gap={16}>
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
									<Button type="submit" width="full">
										{t("createFirstAdmin")}
									</Button>
								</Stack>
							</form>
						) : providers.length === 0 ? (
							<Alert tone="danger" layout="stack">
								<AlertTitle>
									<Text as="div" align="center" variant="caption">
										{t("noLoginTitle")}
									</Text>
								</AlertTitle>
								<AlertDescription>
									<Text as="div" align="center" variant="caption">
										{t("noLogin")}
									</Text>
								</AlertDescription>
							</Alert>
						) : (
							<Stack gap={16}>
								{errorText ? <ErrorAlert text={errorText} /> : null}
								{formProviders.map((authProvider) => (
									<form
										key={authProvider.id}
										method="post"
										action={adminApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`)}
									>
										<Stack gap={16}>
											<TextField id="email" name="email" label={t("email")} type="email" autoComplete="email" />
											<TextField
												id="password"
												name="password"
												label={t("password")}
												type="password"
												autoComplete="current-password"
											/>
											<Button type="submit" width="full">
												{t("signInSubmit")}
											</Button>
										</Stack>
									</form>
								))}
								<Stack gap={8}>
									{buttonProviders.map((authProvider) => (
										<form
											key={authProvider.id}
											method="post"
											action={adminApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`)}
										>
											<Button type="submit" width="full">
												{authProvider.icon ? <Image src={authProvider.icon} alt="" size="icon" radius="none" /> : null}
												{t("signIn", { provider: authProvider.name })}
											</Button>
										</form>
									))}
								</Stack>
							</Stack>
						)}
					</Stack>
				</Stack>
			</Box>
		</Stack>
	);
}

function ErrorAlert({ text }: { text: string }) {
	return (
		<Alert tone="danger" layout="stack">
			<AlertDescription>
				<Text as="div" align="center" variant="caption">
					{text}
				</Text>
			</AlertDescription>
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
		<Stack gap={8}>
			<Label htmlFor={id}>{label}</Label>
			{hint ? (
				<Text as="p" variant="caption" tone="muted">
					{hint}
				</Text>
			) : null}
			<Input id={id} required {...props} />
		</Stack>
	);
}
