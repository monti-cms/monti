/**
 * Runs an AI action by name and returns the result (candidates, text, MDX, memo). Does not change values. Applying happens when the user clicks on screen.
 * If `inputs` (several inputs) is sent, returns a result or failure reason per input in order (translation's Translate all). Problems that would be the same for the other inputs, such as key, credit or request-count
 * problems, stop the whole request. The AI screen's Test sends `draft`, the edited value that is not saved yet.
 * With `stream`, the result is streamed bit by bit (only one input of a streaming action).
 */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
