import type { AdminPlugin } from "../../plugins.js";
/** Draws a plugin's page for a `nav` path. The declaration is read here, in the browser: the server may only refer to a `"use client"` admin module. */
export declare function PluginToolPage({ plugin, name, path, }: {
    readonly plugin: AdminPlugin | undefined;
    readonly name: string;
    readonly path: string;
}): import("react").JSX.Element;
