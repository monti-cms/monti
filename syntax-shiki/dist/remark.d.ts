import type { Root } from "mdast";
import { type NotationSettings } from "./notation.js";
/**
 * Converts the Shiki notation in every code fence to Monti annotation comments (see `notation.ts`).
 *
 * It runs in the CMS parser and in the public render chain, before the code annotations are read, so a body written with Shiki notation
 * is stored with Monti annotations and renders the same without being saved first. Code without notation is not touched.
 */
export declare const remarkShikiNotation: (settings: NotationSettings) => (tree: Root) => undefined;
