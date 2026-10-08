import "server-only";
import { AuthError } from "@monti-cms/core/runtime";
/**
 * Shared admin screen auth. With no session or a different account, redirects to login instead of an error screen.
 * The API answers the same gateway with 401/403.
 */
export async function requireAdminPage(cms, server) {
    try {
        return await cms.authGateway.verifyAdmin();
    }
    catch (error) {
        if (error instanceof AuthError)
            server.redirect(cms.site.adminHref("/login"));
        throw error;
    }
}
