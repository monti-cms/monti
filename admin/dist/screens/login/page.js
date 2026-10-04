import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { adminHref, adminUrl, createTranslator } from "@monti-cms/core/client";
import { auth, authProviders, isAllowedAdminId, isDevAuthBypassEnabled, signIn, signOut, } from "@monti-cms/core/runtime";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card.js";
import { loginMessages } from "./messages.js";
const t = createTranslator(loginMessages);
export default async function AdminLoginPage() {
    if (isDevAuthBypassEnabled()) {
        redirect(adminHref());
    }
    const session = await auth();
    const accountId = session?.user?.accountId;
    // If already signed in as admin, go straight to the dashboard.
    if (accountId && isAllowedAdminId(accountId)) {
        redirect(adminHref());
    }
    const isUnauthorizedUser = Boolean(accountId && !isAllowedAdminId(accountId));
    const providers = authProviders();
    // With a single login method, use its name in the guidance text (e.g. "GitHub admin account").
    const provider = providers.length === 1 ? (providers[0]?.name ?? "") : "";
    return (_jsx("div", { className: "flex min-h-screen flex-col items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-sm", children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { className: "text-2xl", children: t("title") }), _jsx(CardDescription, { children: t("description", { provider }) })] }), _jsx(CardContent, { children: isUnauthorizedUser ? (_jsxs(Alert, { variant: "danger", layout: "stack", className: "text-center", children: [_jsx(AlertTitle, { className: "text-xs", children: t("forbiddenTitle") }), _jsx(AlertDescription, { className: "mt-1 text-xs", children: t("forbidden", { provider, accountId: accountId ?? "" }) }), _jsx("form", { action: async () => {
                                    "use server";
                                    await signOut({ redirectTo: adminUrl("/login") });
                                }, className: "mt-3", children: _jsx(Button, { type: "submit", variant: "link", size: "xs", children: t("signOut") }) })] })) : (_jsx("div", { className: "flex flex-col gap-2", children: providers.map((authProvider) => (_jsx("form", { action: async () => {
                                "use server";
                                await signIn(authProvider.id, { redirectTo: adminUrl() });
                            }, children: _jsx(Button, { type: "submit", className: "w-full", children: t("signIn", { provider: authProvider.name }) }) }, authProvider.id))) })) })] }) }));
}
