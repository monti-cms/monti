import type { SyntaxExtension } from "@monti-cms/core/syntax";
import type { WordEffect } from "./notation";
import { remarkShikiNotation } from "./remark";

export interface ShikiNotationOptions {
	/**
	 * The text effect `[!code word:foo]` becomes: `@char name {re:/foo/g}` on the line (or lines) it covers. Default `"strong"`.
	 * `false` leaves `[!code word:…]` as it is.
	 */
	readonly word?: WordEffect | false;
}

/**
 * Shiki code notation (`const a = 1 // [!code ++]`) in code fences, read as Monti code annotations. Reading only: there is no writer,
 * so a body is always written back with Monti's own annotation comments (`// @line plus`), which migrates content a post at a time as it is saved.
 *
 * `++` and `--` become `plus` and `minus`, `highlight` and `hl` become `highlight`, `error` and `warning` stay as they are, and `focus` becomes
 * the site's `focus` line effect if `codeBlock.lineEffects` defines one, otherwise `highlight`. `info` is converted only if the site defines an `info` line effect.
 *
 * @experimental
 */
export const shikiNotation = (options: ShikiNotationOptions = {}): SyntaxExtension => ({
	name: "shiki",
	remarkPlugins: (context) => [
		[remarkShikiNotation, { word: options.word ?? "strong", lineEffects: context.codeLineEffects }],
	],
});
