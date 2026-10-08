import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl } from "@monti-cms/core/client";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card.js";
import { loginMessages } from "./messages.js";
/**
 * Sign in and out are plain form posts to the core API (its `v1/session/*` routes), not server actions: a server action cannot carry the
 * CMS instance, because the values it closes over must be serializable.
 */
export default async function AdminLoginPage({ cms, server }) {
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
    return (_jsx("div", { className: "flex min-h-screen flex-col items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-sm", children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { className: "text-2xl", children: t("title") }), _jsx(CardDescription, { children: t("description", { provider }) })] }), _jsx(CardContent, { children: isUnauthorizedUser ? (_jsxs(Alert, { variant: "danger", layout: "stack", className: "text-center", children: [_jsx(AlertTitle, { className: "text-xs", children: t("forbiddenTitle") }), _jsx(AlertDescription, { className: "mt-1 text-xs", children: t("forbidden", { provider, accountId: accountId ?? "" }) }), _jsx("form", { method: "post", action: cmsApiUrl("/v1/session/sign-out"), className: "mt-3", children: _jsx(Button, { type: "submit", variant: "link", size: "xs", children: t("signOut") }) })] })) : (_jsx("div", { className: "flex flex-col gap-2", children: providers.map((authProvider) => (_jsx("form", { method: "post", action: cmsApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`), children: _jsxs(Button, { type: "submit", className: "w-full", children: [authProvider.icon ? (_jsx("img", { src: authProvider.icon, alt: "", "aria-hidden": "true", className: "size-4" })) : null, t("signIn", { provider: authProvider.name })] }) }, authProvider.id))) })) })] }) }));
}
