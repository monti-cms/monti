import type { Cms } from "@monti-cms/core/runtime";
/**
 * What stops the login from starting (a missing `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` or `MONTI_SECRET`), as the server throws it, or `undefined` when the login can
 * start. Under `next dev` the development login stands in for GitHub, so this is mostly what a production server without its settings hits.
 * The full message goes to the server log once; the screen names no setting.
 */
export declare function setupProblemOf(cms: Pick<Cms, "auth">): string | undefined;
/**
 * The admin when the login is not set up: a plain screen that points to `monti doctor`, instead of Next's generic error page (which hides the message in production).
 * It is the admin, not a public page, so the status is whatever Next sends (a `200` under Cache Components).
 */
export declare function SetupProblemScreen({ cms }: {
    cms: Pick<Cms, "site">;
}): import("react").JSX.Element;
