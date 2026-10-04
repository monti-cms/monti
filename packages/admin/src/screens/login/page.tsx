import { adminHref, adminUrl, createTranslator } from "@monti-cms/core/client";
import {
	auth,
	authProviders,
	isAllowedAdminId,
	isDevAuthBypassEnabled,
	signIn,
	signOut,
} from "@monti-cms/core/runtime";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { loginMessages } from "./messages";

const t = createTranslator(loginMessages);

export default async function AdminLoginPage() {
	if (isDevAuthBypassEnabled()) {
		redirect(adminHref() as Route);
	}

	const session = await auth();
	const accountId = session?.user?.accountId;

	// 이미 관리자로 로그인했으면 바로 대시보드로 간다.
	if (accountId && isAllowedAdminId(accountId)) {
		redirect(adminHref() as Route);
	}

	const isUnauthorizedUser = Boolean(accountId && !isAllowedAdminId(accountId));
	const providers = authProviders();
	// 로그인 방식이 하나면 안내 문구에 그 이름을 쓴다(예: "GitHub 관리자 계정").
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
							<form
								action={async () => {
									"use server";
									await signOut({ redirectTo: adminUrl("/login") });
								}}
								className="mt-3"
							>
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
									action={async () => {
										"use server";
										await signIn(authProvider.id, { redirectTo: adminUrl() });
									}}
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
