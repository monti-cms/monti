import "server-only";
import { adminHref } from "@monti-cms/core/client";
import { type AuthContext, AuthError, authGateway } from "@monti-cms/core/runtime";
import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * Shared admin screen auth. With no session or a different account, redirects to login instead of an error screen.
 * The API answers the same gateway with 401/403.
 */
export async function requireAdminPage(): Promise<AuthContext> {
	try {
		return await authGateway.verifyAdmin();
	} catch (error) {
		if (error instanceof AuthError) redirect(adminHref("/login") as Route);
		throw error;
	}
}
