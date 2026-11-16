import type { BlockProps } from "@monti-cms/core/render";
import katex from "katex";
// KaTeX's own stylesheet (the letters' fonts and the layout of its boxes), from the installed package: the site's bundler serves it and its fonts.
import "katex/dist/katex.min.css";
import { style } from "./style";

/** A formula drawn by KaTeX, or the reason it is not one. */
export function drawFormula(source: string): { html: string } | { error: string } {
	try {
		return { html: katex.renderToString(source, { displayMode: true, throwOnError: true, output: "htmlAndMathml" }) };
	} catch (error) {
		return { error: error instanceof Error ? error.message.replace(/^KaTeX parse error: /, "") : String(error) };
	}
}

/**
 * A formula (` ```math `): drawn on the server by KaTeX, so the page needs no script for it. One that does not read stays its source: the reason is
 * for the person writing it and shows in the editor only, never to a reader (`drawFormula`).
 */
function MathBlockDrawing({ attrs, lang }: BlockProps) {
	const source = typeof attrs.source === "string" ? attrs.source : "";
	if (source.trim() === "") return null;
	const drawn = drawFormula(source);
	return "html" in drawn ? (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own markup, made from the formula with no HTML of the writer's in it (`trust` is off).
		<div className="monti-block-math" lang={lang} dangerouslySetInnerHTML={{ __html: drawn.html }} />
	) : (
		<figure className="monti-block-math" data-state="error" lang={lang}>
			<pre className="monti-block-math-source">
				<code>{source}</code>
			</pre>
		</figure>
	);
}

/** MathBlock with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function MathBlock(props: Parameters<typeof MathBlockDrawing>[0]) {
	return (
		<>
			<style href="monti-block-math" precedence="monti-blocks">
				{style}
			</style>
			<MathBlockDrawing {...props} />
		</>
	);
}
