import { remarkShikiNotation } from "./remark.js";
/**
 * Shiki code notation (`const a = 1 // [!code ++]`) in code fences, read as Monti code annotations. Reading only: there is no writer,
 * so a body is always written back with Monti's own annotation comments (`// @line plus`), which migrates content a post at a time as it is saved.
 *
 * `++` and `--` become `plus` and `minus`, `highlight` and `hl` become `highlight`, `error` and `warning` stay as they are, and `focus` becomes
 * the `focus` line effect (a default one; `highlight` only for a line effect list without it). `info` is converted only if the site defines an `info` line effect.
 *
 * @experimental
 */
export const shikiNotation = (options = {}) => ({
    name: "shiki",
    remarkPlugins: (context) => [
        [remarkShikiNotation, { word: options.word ?? "strong", lineEffects: context.codeLineEffects }],
    ],
});
