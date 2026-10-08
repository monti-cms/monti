type KeyParams = {
    key: string;
};
/** Resets an action to its defaults (the definition in the site config). Whether it is on stays as the current value. */
export declare const POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<KeyParams>> | undefined) => Promise<Response>;
export {};
