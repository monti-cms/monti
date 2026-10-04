import type { Element } from "hast";
import type { ShikiTransformer } from "shiki";
export type Meta = Record<string, unknown>;
export type LineDecorationPayload = {
    scope: "line";
    name: string;
    range: {
        start: number;
        end: number;
    };
    order: number;
    class: string;
    attributes?: {
        name: string;
        value: unknown;
    }[];
};
export type LineWrapperPayload = {
    scope: "line";
    name: string;
    range: {
        start: number;
        end: number;
    };
    order: number;
    render: string;
    attributes?: {
        name: string;
        value: unknown;
    }[];
};
export declare const addMetaToPre: (code: string, meta: Meta) => ShikiTransformer;
export declare const addLineDecorations: (lineDecorations?: LineDecorationPayload[]) => ShikiTransformer;
export declare const applyLineWrappers: (codeEl: Element, rowWrappers?: LineWrapperPayload[], allowedRenderTags?: readonly string[]) => void;
export declare const addLineWrappers: (rowWrappers?: LineWrapperPayload[], allowedRenderTags?: readonly string[]) => ShikiTransformer;
export declare const applyInlineAnnoRenderTags: (codeEl: Element, allowedRenderTags?: readonly string[]) => void;
export declare const convertInlineAnnoToRenderTag: (allowedRenderTags?: readonly string[]) => ShikiTransformer;
/**
 * Numbers in-code tooltips in order (`note`) and passes the description list to the `<pre>`'s `notes` (JSON).
 * On touch devices (screens without hover), a number and a list of notes below the code are shown instead of a tooltip (`pre`, `Tooltip`).
 * It must run after line wrapping (folding) is done so that the visible order matches the numbers.
 */
export declare const numberCodeNotes: () => ShikiTransformer;
/** Whether the code fence meta turned line numbers on (`lnum`, `showLineNumbers`; `=false` turns them off). */
export declare const showsLineNumbers: (meta: Meta) => boolean;
/**
 * Puts the actual line number (`data-line`) on each line. Line numbers use this value instead of a CSS counter —
 * folded lines (`collapse`) are not on screen so a counter does not count them, and line numbers after the fold would shift.
 */
export declare const addLineNumbers: () => ShikiTransformer;
