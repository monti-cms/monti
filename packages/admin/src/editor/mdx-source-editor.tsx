"use client";

import { type ComponentProps, type CSSProperties, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils/cn";
import { getShikiHighlighter } from "./code-block/highlight-plugin";

type Token = { content: string; light?: string; dark?: string };
type HighlightedLine = { text: string; tokens: Token[] };

/** A token colored per line. The color uses the light theme value and switches to `--shiki-dark` in the dark theme. */
async function highlightMdx(source: string): Promise<HighlightedLine[]> {
	const highlighter = await getShikiHighlighter();
	const lines = highlighter.codeToTokensWithThemes(source, {
		lang: "mdx",
		themes: { light: "one-light", dark: "one-dark-pro" },
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

	useEffect(() => {
		let cancelled = false;
		const timer = setTimeout(() => {
			highlightMdx(value)
				.then((lines) => {
					if (!cancelled) setHighlighted(lines);
				})
				.catch(() => {
					if (!cancelled) setHighlighted([]);
				});
		}, 120);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [value]);

	const lines = useMemo(() => value.split("\n"), [value]);

	return (
		<div className={cn("grid font-mono text-sm leading-6", className)}>
			<pre
				aria-hidden
				className="pointer-events-none col-start-1 row-start-1 m-0 min-w-0 whitespace-pre-wrap break-words bg-transparent p-0 font-[inherit] text-cms-foreground cms-dark:[&_span[style]]:text-(--shiki-dark)!"
			>
				{lines.map((line, index) => {
					const cached = highlighted[index];
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: the line number is the position
						<span key={index}>
							{cached && cached.text === line
								? cached.tokens.map((token, tokenIndex) => (
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
				className="col-start-1 row-start-1 m-0 min-h-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-[inherit] text-transparent caret-cms-foreground outline-none selection:bg-cms-primary/20 selection:text-transparent placeholder:text-cms-muted-foreground"
			/>
		</div>
	);
}
