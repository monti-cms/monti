import type { BlockProps } from "@monti-cms/core/render";
import katex from "katex";

/** A formula drawn by KaTeX, or the reason it is not one. */
export function drawFormula(source: string): { html: string } | { error: string } {
	try {
		return { html: katex.renderToString(source, { displayMode: true, throwOnError: true, output: "htmlAndMathml" }) };
	} catch (error) {
		return { error: error instanceof Error ? error.message.replace(/^KaTeX parse error: /, "") : String(error) };
	}
}

/**
 * A formula (` ```math `): drawn on the server by KaTeX, so the page needs no script for it. One that does not read stays its source, with the reason
 * under it. KaTeX's own stylesheet comes with `math.css`.
 */
export function MathBlock({ attrs }: BlockProps) {
	const source = typeof attrs.source === "string" ? attrs.source : "";
	if (source.trim() === "") return null;
	const drawn = drawFormula(source);
	return "html" in drawn ? (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own markup, made from the formula with no HTML of the writer's in it (`trust` is off).
		<div className="monti-block-math" dangerouslySetInnerHTML={{ __html: drawn.html }} />
	) : (
		<figure className="monti-block-math" data-state="error">
			<pre className="monti-block-math-source">
				<code>{source}</code>
			</pre>
			<figcaption className="monti-block-math-error">{drawn.error}</figcaption>
		</figure>
	);
}
