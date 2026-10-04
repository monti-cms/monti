import type { ParsedCodeBlockMeta } from "./types.js";
/**
 * Parses a code fence meta string (`title="file.ts" lnum`).
 */
export declare function parseMeta(meta: string | null | undefined): ParsedCodeBlockMeta;
/**
 * Serializes parsed meta attributes into a code fence meta string.
 */
export declare function formatMeta({ title, showLineNumbers, raw, }: {
    title?: string;
    showLineNumbers?: boolean;
    raw?: Record<string, unknown>;
}): string | null;
