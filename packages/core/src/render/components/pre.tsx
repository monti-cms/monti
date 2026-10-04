import type { CSSProperties, ReactNode } from "react";
import { showsLineNumbers } from "../code";
import { CmsCopyButton } from "./copy-button";

const parseNotes = (notes: string | undefined): string[] => {
	if (!notes) return [];
	try {
		const parsed: unknown = JSON.parse(notes);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
};

export interface CmsPreProps {
	readonly children?: ReactNode;
	/** Original code (copy button). Added by code highlighting. */
	readonly code?: string;
	/** File name (`title="src/a.ts"`). If present, the title row is shown. */
	readonly title?: string;
	/** Line numbers (code fence meta `lnum` and `showLineNumbers`). */
	readonly lnum?: boolean | string;
	readonly showLineNumbers?: boolean;
	/** Tooltip descriptions inside code (in number order, JSON array). On screens without hover, they appear as a list below the code. */
	readonly notes?: string;
	readonly className?: string;
	readonly style?: CSSProperties;
	readonly copyLabel?: string;
	readonly copiedLabel?: string;
	readonly notesLabel?: string;
}

/**
 * Code block frame (the `<pre>` made by code highlighting). Attaches the title row, copy button, line numbers and the in-code tooltip list, and does not let the attributes
 * the highlighter leaves (`code`, `title`, `lnum`, `notes`) flow into `<pre>` as they are.
 */
export function CmsPre({
	children,
	code,
	title,
	lnum,
	showLineNumbers,
	notes,
	className,
	style,
	copyLabel = "Copy",
	copiedLabel = "Copied",
	notesLabel = "Code notes",
}: CmsPreProps) {
	const numbered = showsLineNumbers({ showLineNumbers, lnum });
	const noteList = parseNotes(notes);
	const path = title?.trim().split("/").filter(Boolean) ?? [];
	return (
		<div className="cms-code">
			{path.length > 0 ? (
				<div className="cms-code-title" data-title={title}>
					{path.map((part, index) => (
						<span key={`${index}-${part}`} className={index === path.length - 1 ? "cms-code-title-file" : undefined}>
							{part}
							{index < path.length - 1 ? " / " : ""}
						</span>
					))}
				</div>
			) : null}
			{/* CSS draws line numbers whenever the attribute exists. If off, the attribute is not set. */}
			<pre className={className} style={style} data-show-line-numbers={numbered || undefined}>
				{children}
			</pre>
			{code ? <CmsCopyButton text={code} label={copyLabel} copiedLabel={copiedLabel} /> : null}
			{noteList.length > 0 ? (
				<ol className="cms-code-notes" aria-label={notesLabel}>
					{noteList.map((note, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: the annotation number is the order
						<li key={index}>
							<span className="cms-code-note-number">{index + 1}</span>
							<span>{note}</span>
						</li>
					))}
				</ol>
			) : null}
		</div>
	);
}
