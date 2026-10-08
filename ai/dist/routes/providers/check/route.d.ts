/**
 * Connection check. Sends one short request with the input values (address, key, default model) before saving. Saves after the check.
 * A failure is also 200, with `ok: false` and the reason.
 */
export declare const POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
