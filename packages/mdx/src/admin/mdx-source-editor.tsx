"use client";

import { useDebounced } from "@monti-cms/admin/kit";
import { type ComponentProps, type CSSProperties, useEffect, useMemo, useState } from "react";

type Token = { content: string; light?: string; dark?: string };
type HighlightedLine = { text: string; tokens: Token[] };

const THEMES = { light: "one-light", dark: "one-dark-pro" } as const;

type Highlighter = Awaited<ReturnType<typeof import("shiki")["createHighlighter"]>>;
let highlighterPromise: Promise<Highlighter> | undefined;

/** The Shiki highlighter of the source field, created on first use (it is a heavy import, so it loads only when the panel is shown). */
const getHighlighter = (): Promise<Highlighter> => {
	highlighterPromise ??= import("shiki").then(({ createHighlighter }) =>
		createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: ["mdx"] }),
	);
	return highlighterPromise;
};

/** A token colored per line. The color uses the light theme value and switches to `--shiki-dark` in the dark theme. */
async function highlightMdx(source: string): Promise<HighlightedLine[]> {
	const highlighter = await getHighlighter();
	const lines = highlighter.codeToTokensWithThemes(source, {
		lang: "mdx",
		themes: THEMES,
	});
	return lines.map((line) => ({
		text: line.map((token) => token.content).join(""),
		tokens: line.map((token) => ({
			content: token.content,
			light: token.variants?.light?.color,
			dark: token.variants?.dark?.color,
		})),
	}));
}

const styleOf = (token: Token): CSSProperties | undefined =>
	token.light || token.dark ? ({ color: token.light, "--shiki-dark": token.dark } as CSSProperties) : undefined;

/**
 * MDX source edit field. Text is written into an invisible input, and an overlaid layer in the same spot shows MDX syntax colors.
 * Colors are re-applied after typing pauses briefly. Until then only the changed line shows without color (so the text does not look misaligned).
 */
export function MdxSourceEditor({
	value,
	className,
	...props
}: Omit<ComponentProps<"textarea">, "value"> & { value: string }) {
	const [highlighted, setHighlighted] = useState<HighlightedLine[]>([]);

	// Highlighting follows the text after a short pause; a result that arrives after the next text is dropped.
	const settled = useDebounced(value, 120);
	useEffect(() => {
		let cancelled = false;
		highlightMdx(settled)
			.then((lines) => {
				if (!cancelled) setHighlighted(lines);
			})
			.catch(() => {
				if (!cancelled) setHighlighted([]);
			});
		return () => {
			cancelled = true;
		};
	}, [settled]);

	const lines = useMemo(() => value.split("\n"), [value]);

	return (
		<div className={["grid font-mono text-monti-body", className].filter(Boolean).join(" ")}>
			<pre
				aria-hidden
				className="pointer-events-none col-start-1 row-start-1 m-0 min-w-0 whitespace-pre-wrap break-words bg-transparent p-0 font-[inherit] text-monti-default monti-dark:[&_span[style]]:text-(--shiki-dark)!"
			>
				{lines.map((line, index) => {
					const cached = highlighted[index];
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: the line number is the position
						<span key={index}>
							{cached && cached.text === line
								? cached.tokens.map((token, tokenIndex) => (
										// design-allow: token colors are computed by the highlighter
										// biome-ignore lint/suspicious/noArrayIndexKey: token order within the line
										<span key={tokenIndex} style={styleOf(token)}>
											{token.content}
										</span>
									))
								: line}
							{index < lines.length - 1 ? "\n" : "​"}
						</span>
					);
				})}
			</pre>
			<textarea
				{...props}
				value={value}
				spellCheck={false}
				className="col-start-1 row-start-1 m-0 min-h-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-[inherit] text-transparent caret-monti-default outline-none selection:bg-monti-muted selection:text-transparent placeholder:text-monti-muted"
			/>
		</div>
	);
}
