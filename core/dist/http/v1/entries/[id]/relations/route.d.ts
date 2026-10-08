/** Where this entry is used (back references). Distinguishes draft and published usages. */
export declare const GET: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<{
    id: string;
}>> | undefined) => Promise<Response>;
