import "server-only";
import { type AuthContext } from "@monti-cms/core/runtime";
/**
 * Shared admin screen auth. With no session or a different account, redirects to login instead of an error screen.
 * The API answers the same gateway with 401/403.
 */
export declare function requireAdminPage(): Promise<AuthContext>;
