/** Marks the site as a preview's: writes through the admin's helpers are refused. */
export declare function markSandboxSite<T extends object>(site: T): T;
export declare const isSandboxSite: (site: object) => boolean;
/** Whether a request with this method changes something on the server. */
export declare const isWrite: (method: string | undefined) => boolean;
