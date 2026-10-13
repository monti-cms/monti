import type { Site } from "@monti-cms/core/client";
/** Marks the site as a preview's: writes through the admin's helpers are refused. */
export declare function markSandboxSite<T extends object>(site: T): T;
export declare const isSandboxSite: (site: object) => boolean;
/** Whether a request with this method changes something on the server. */
export declare const isWrite: (method: string | undefined) => boolean;
/** Thrown instead of a write made for a preview site. */
export declare class SandboxWriteError extends Error {
    constructor(message: string);
}
export type { Site };
