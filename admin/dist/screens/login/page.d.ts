import type { Cms } from "@monti-cms/core/runtime";
import type * as React from "react";
import type { AdminServer } from "../../host/server.js";
/**
 * Sign in and out are plain form posts to the core API (its `v1/session/*` routes), not server actions: a server action cannot carry the
 * CMS instance, because the values it closes over must be serializable.
 */
export default function AdminLoginPage({ cms, server, searchParams, }: {
    cms: Cms;
    server: AdminServer;
    /** The query of the address: `error` says why the last attempt did not work (Auth.js's `CredentialsSignin`, or a reason from the first-admin route). */
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element>;
