/** The AI action list (definition + edited values) and the names of actions usable now (connection ready). Slots only attach enabled actions that are usable. */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
/**
 * Creates a screen action. The body is `{ base: { label, surface, result, engine? }, value?: edited value }`.
 * If edited values (connection, model, instructions, checks, etc.) are given too, they are saved at once.
 */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
