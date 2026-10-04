import "server-only";
import { adminHref } from "@monti-cms/core/client";
import { AuthError, authGateway } from "@monti-cms/core/runtime";
import { redirect } from "next/navigation";
/**
 * Shared admin screen auth. With no session or a different account, redirects to login instead of an error screen.
 * The API answers the same gateway with 401/403.
 */
export async function requireAdminPage() {
    try {
        return await authGateway.verifyAdmin();
    }
    catch (error) {
        if (error instanceof AuthError)
            redirect(adminHref("/login"));
        throw error;
    }
}
