import type { BlockDefinition } from "@monti-cms/core/client";
import type { BlockConverter } from "./types.js";
/**
 * Converter for an added code fence block (e.g. ` ```mermaid `). Turns a code block of that language into a block node and restores the language and meta
 * as they were on save. On a site without the block installed, it stays a plain code block.
 */
export declare function fenceBlockConverter(block: BlockDefinition, nodeName: string): BlockConverter;
export declare const mathConverter: BlockConverter;
