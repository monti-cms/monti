import { cmsApiUrl } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { loginMessages } from "./messages";

/**
 * Sign in and out are plain form posts to the core API (its `v1/session/*` routes), not server actions: a server action cannot carry the
 * CMS instance, because the values it closes over must be serializable.
 */
export default async function AdminLoginPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	const { site } = cms;
	const t = site.createTranslator(loginMessages);
	if (await cms.authGateway.isDevBypassActive()) {
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
	// With a single login method, use its name in the guidance text (e.g. "GitHub admin account").
	const provider = providers.length === 1 ? (providers[0]?.name ?? "") : "";

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">{t("title")}</CardTitle>
					<CardDescription>{t("description", { provider })}</CardDescription>
				</CardHeader>
				<CardContent>
					{isUnauthorizedUser ? (
						<Alert variant="danger" layout="stack" className="text-center">
							<AlertTitle className="text-xs">{t("forbiddenTitle")}</AlertTitle>
							<AlertDescription className="mt-1 text-xs">
								{t("forbidden", { provider, accountId: accountId ?? "" })}
							</AlertDescription>
							<form method="post" action={cmsApiUrl("/v1/session/sign-out")} className="mt-3">
								<Button type="submit" variant="link" size="xs">
									{t("signOut")}
								</Button>
							</form>
						</Alert>
					) : (
						<div className="flex flex-col gap-2">
							{providers.map((authProvider) => (
								<form
									key={authProvider.id}
									method="post"
									action={cmsApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`)}
								>
									<Button type="submit" className="w-full">
										{t("signIn", { provider: authProvider.name })}
									</Button>
								</form>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
