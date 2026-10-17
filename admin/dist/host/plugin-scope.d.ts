import { type ReactNode } from "react";
import type { LoadedAdminPlugin } from "../internal-plugins.js";
/**
 * The plugins' admin sides around the admin UI, in registration order (the first plugin outermost, so a later one's registration of the same name wins).
 * The host renders it on the server and the declarations are applied in the browser.
 */
export declare function AdminPluginScope({ plugins, children, }: {
    readonly plugins: readonly LoadedAdminPlugin[];
    readonly children: ReactNode;
}): ReactNode;
