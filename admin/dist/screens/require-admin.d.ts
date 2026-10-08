import "server-only";
import { type AuthContext, type Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../host/server.js";
/**
 * Shared admin screen auth. With no session or a different account, redirects to login instead of an error screen.
 * The API answers the same gateway with 401/403.
 */
export declare function requireAdminPage(cms: Cms, server: AdminServer): Promise<AuthContext>;
