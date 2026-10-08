/**
 * Stops with a message that says what to change when a Next file got no CMS instance: the usual cause is an import of the wrong name or from the wrong file, and
 * the plain `Cannot read properties of undefined` that follows does not say so.
 */
export declare function assertCms(cms: unknown, caller: string): void;
