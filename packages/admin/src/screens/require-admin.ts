import "server-only";
import { type AuthContext, AuthError, type Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../host/server";

/**
 * Shared admin screen auth. With no session or a different account, redirects to login instead of an error screen.
 * The API answers the same gateway with 401/403.
 */
export async function requireAdminPage(cms: Cms, server: AdminServer): Promise<AuthContext> {
	try {
		return await cms.authGateway.verifyAdmin();
	} catch (error) {
		if (error instanceof AuthError) server.redirect(cms.site.adminHref("/login"));
		throw error;
	}
}
