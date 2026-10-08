import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert.js";
import { layoutMessages } from "./messages.js";
const REPORTED = Symbol.for("monti.admin.setup-problem.reported");
/**
 * What stops the login from starting (a missing `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` or `MONTI_SECRET`), as the server throws it, or `undefined` when the login can
 * start. Under `next dev` the development login stands in for GitHub, so this is mostly what a production server without its settings hits.
 * The full message goes to the server log once; the screen names no setting.
 */
export function setupProblemOf(cms) {
    try {
        cms.auth();
        return undefined;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const holder = globalThis;
        if (holder[REPORTED] !== message) {
            holder[REPORTED] = message;
            console.error(`Monti admin is not set up: ${message}`);
        }
        return message;
    }
}
/**
 * The admin when the login is not set up: a plain screen that points to `monti doctor`, instead of Next's generic error page (which hides the message in production).
 * It is the admin, not a public page, so the status is whatever Next sends (a `200` under Cache Components).
 */
export function SetupProblemScreen({ cms }) {
    const t = cms.site.createTranslator(layoutMessages);
    return (_jsx("div", { className: "cms-admin flex min-h-screen items-center justify-center bg-cms-background p-4 text-cms-foreground", children: _jsxs(Alert, { variant: "danger", layout: "stack", className: "max-w-md", children: [_jsx(AlertTitle, { children: t("setupTitle") }), _jsx(AlertDescription, { className: "mt-1", children: t("setupBody") })] }) }));
}
