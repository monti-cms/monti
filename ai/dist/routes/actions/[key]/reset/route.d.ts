type KeyParams = {
    key: string;
};
/** Resets an action to its defaults (the definition in the site config). Whether it is on stays as the current value. */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<KeyParams>;
} | undefined) => Promise<Response>;
export {};
