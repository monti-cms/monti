import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl } from "@monti-cms/core/client";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card.js";
import { Input } from "../../ui/input.js";
import { Label } from "../../ui/label.js";
import { loginMessages } from "./messages.js";
/**
 * Sign in and out are plain form posts to the core API (its `v1/session/*` routes), not server actions: a server action cannot carry the
 * CMS instance, because the values it closes over must be serializable.
 */
export default async function AdminLoginPage({ cms, server, searchParams, }) {
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
    return (_jsx("div", { className: "flex min-h-screen flex-col items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-sm", children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { className: "text-2xl", children: firstAdmin ? t("firstAdminTitle") : t("title") }), _jsx(CardDescription, { children: firstAdmin
                                ? t("firstAdminDescription")
                                : formProviders.length > 0 && buttonProviders.length === 0
                                    ? t("passwordDescription")
                                    : t("description", { provider }) })] }), _jsx(CardContent, { children: isUnauthorizedUser ? (_jsxs(Alert, { variant: "danger", layout: "stack", className: "text-center", children: [_jsx(AlertTitle, { className: "text-xs", children: t("forbiddenTitle") }), _jsx(AlertDescription, { className: "mt-1 text-xs", children: t("forbidden", { provider, accountId: accountId ?? "" }) }), _jsx("form", { method: "post", action: cmsApiUrl("/v1/session/sign-out"), className: "mt-3", children: _jsx(Button, { type: "submit", variant: "link", size: "xs", children: t("signOut") }) })] })) : firstAdmin ? (_jsxs("form", { method: "post", action: cmsApiUrl("/v1/session/first-admin"), className: "flex flex-col gap-4", children: [errorText ? _jsx(ErrorAlert, { text: errorText }) : null, _jsx(TextField, { id: "email", name: "email", label: t("email"), type: "email", autoComplete: "email" }), _jsx(TextField, { id: "password", name: "password", label: t("password"), type: "password", autoComplete: "new-password", minLength: min, hint: t("passwordHint", { min }) }), _jsx(TextField, { id: "confirm", name: "confirm", label: t("confirmPassword"), type: "password", autoComplete: "new-password", minLength: min }), _jsx(Button, { type: "submit", className: "w-full", children: t("createFirstAdmin") })] })) : providers.length === 0 ? (_jsxs(Alert, { variant: "danger", layout: "stack", className: "text-center", children: [_jsx(AlertTitle, { className: "text-xs", children: t("noLoginTitle") }), _jsx(AlertDescription, { className: "mt-1 text-xs", children: t("noLogin") })] })) : (_jsxs("div", { className: "flex flex-col gap-4", children: [errorText ? _jsx(ErrorAlert, { text: errorText }) : null, formProviders.map((authProvider) => (_jsxs("form", { method: "post", action: cmsApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`), className: "flex flex-col gap-4", children: [_jsx(TextField, { id: "email", name: "email", label: t("email"), type: "email", autoComplete: "email" }), _jsx(TextField, { id: "password", name: "password", label: t("password"), type: "password", autoComplete: "current-password" }), _jsx(Button, { type: "submit", className: "w-full", children: t("signInSubmit") })] }, authProvider.id))), _jsx("div", { className: "flex flex-col gap-2", children: buttonProviders.map((authProvider) => (_jsx("form", { method: "post", action: cmsApiUrl(`/v1/session/sign-in/${encodeURIComponent(authProvider.id)}`), children: _jsxs(Button, { type: "submit", className: "w-full", children: [authProvider.icon ? (_jsx("img", { src: authProvider.icon, alt: "", "aria-hidden": "true", className: "size-4" })) : null, t("signIn", { provider: authProvider.name })] }) }, authProvider.id))) })] })) })] }) }));
}
function ErrorAlert({ text }) {
    return (_jsx(Alert, { variant: "danger", layout: "stack", className: "text-center", children: _jsx(AlertDescription, { className: "text-xs", children: text }) }));
}
/** One labelled input of the login forms. */
function TextField({ id, label, hint, ...props }) {
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: id, children: label }), _jsx(Input, { id: id, required: true, ...props }), hint ? _jsx("p", { className: "text-cms-muted-foreground text-xs", children: hint }) : null] }));
}
