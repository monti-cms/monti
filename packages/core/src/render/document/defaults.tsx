import { type ComponentType, type CSSProperties, createElement, type ReactNode } from "react";
import { CmsCodeCollapse, CmsCodeFold } from "../components/code-lines";
import { CmsCopyButton } from "../components/copy-button";
import { CmsFile } from "../components/file";
import { CmsImage } from "../components/image";
import { CmsLink } from "../components/link";
import { CmsTextAlign } from "../components/text-align";
import type {
	BlockquoteProps,
	CodeBlockProps,
	CoreMarkComponents,
	FileProps,
	FootnoteRefProps,
	FootnotesProps,
	HardBreakProps,
	HeadingProps,
	HorizontalRuleProps,
	ImageProps,
	LinkProps,
	ListItemProps,
	ListProps,
	LooseDocumentComponents,
	MarkProps,
	MathProps,
	ParagraphProps,
	TableCellProps,
	TableProps,
	TableRowProps,
	TextAlignProps,
	UnknownProps,
} from "./types";

/**
 * The core default components of the JSON renderer. Their markup is what the MDX chain produced (`remark-gfm`, `rehype-slug`,
 * `rehype-autolink-headings`, `rehype-katex` and the `Cms*` components), so the page looks the same and `render.css` keeps working.
 */

const Paragraph = ({ children }: ParagraphProps) => <p>{children}</p>;

/**
 * The link on a heading. It is hidden from assistive technology (the heading is the name) and the icon is drawn by CSS. It is made with `createElement`
 * because the accessibility lint for links with no text does not know that.
 */
const HeadingAnchor = ({ id }: { id: string }) =>
	createElement(
		"a",
		{ href: `#${id}`, "aria-hidden": "true", tabIndex: -1 },
		createElement("span", { className: "icon icon-link" }),
	);

const Heading = ({ level, id, children }: HeadingProps) => {
	const Tag = `h${level}` as "h1";
	return (
		<Tag id={id}>
			{id ? <HeadingAnchor id={id} /> : null}
			{children}
		</Tag>
	);
};

const List = ({ ordered, start, tasks, children }: ListProps) =>
	ordered ? (
		<ol start={start !== undefined && start !== 1 ? start : undefined}>{children}</ol>
	) : (
		<ul className={tasks ? "contains-task-list" : undefined}>{children}</ul>
	);

const ListItem = ({ checked, children }: ListItemProps) => (
	<li className={checked === undefined ? undefined : "task-list-item"}>{children}</li>
);

const Blockquote = ({ children }: BlockquoteProps) => <blockquote>{children}</blockquote>;

const HorizontalRule = (_: HorizontalRuleProps) => <hr />;

const HardBreak = (_: HardBreakProps) => <br />;

const CodeBlock = ({ title, code, notes, children, ctx }: CodeBlockProps) => {
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
			{children}
			{code ? <CmsCopyButton text={code} label={ctx.labels.copyCode} copiedLabel={ctx.labels.copied} /> : null}
			{notes.length > 0 ? (
				<ol className="cms-code-notes" aria-label={ctx.labels.codeNotes}>
					{notes.map((note, index) => (
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
};

const Image = ({
	src,
	alt,
	title,
	caption,
	decorative,
	align,
	width,
	crop,
	rotate,
	intrinsic,
	failure,
	plain,
	inline,
	node,
	ctx,
}: ImageProps) => {
	if (plain && src) {
		// A Markdown image: just the picture (a block of its own sits in a paragraph, as Markdown makes it).
		// biome-ignore lint/performance/noImgElement: public addresses differ per site, so next/image is not used
		const image = <img src={src} alt={alt} title={title} />;
		return inline ? image : <p>{image}</p>;
	}
	const result = src
		? { url: src, width: intrinsic?.width, height: intrinsic?.height }
		: { failure: failure ?? ("unresolved" as const) };
	return (
		<CmsImage
			src={src}
			alt={alt}
			width={width}
			align={align}
			caption={caption}
			decorative={decorative}
			crop={crop}
			rotate={rotate}
			title={title}
			resolve={() => result}
			unavailableLabel={ctx.labels.imageUnavailable}
			mediaId={typeof node.attrs?.mediaId === "string" ? node.attrs.mediaId : undefined}
		/>
	);
};

const File = ({ mediaId, label, url, filename, byteSize, mimeType, failure, ctx }: FileProps) => {
	const result = url
		? { url, file: { filename: filename ?? label, byteSize: byteSize ?? null, mimeType: mimeType ?? null } }
		: { failure: failure ?? ("unresolved" as const) };
	return (
		<CmsFile
			mediaId={mediaId ?? ""}
			label={label}
			resolve={() => result}
			downloadLabel={ctx.labels.download}
			unavailableLabel={ctx.labels.fileUnavailable}
		/>
	);
};

const TextAlign = ({ align, children }: TextAlignProps) => <CmsTextAlign align={align}>{children}</CmsTextAlign>;

const Table = ({ columns, widths, hasHead, head, body }: TableProps) => {
	// Same as the editor (prosemirror-tables): if all column widths are known, use the total width; if only some, use a minimum width.
	const known = Array.from({ length: columns }, (_, index) => widths[index] ?? null);
	const total = known.reduce<number>((sum, width) => sum + (width ?? 0), 0);
	const style: CSSProperties | undefined =
		widths.length === 0 || columns === 0
			? undefined
			: known.every((width) => width !== null)
				? { width: total, maxWidth: "none" }
				: { minWidth: total };
	// No border or background is set separately. It takes the same prose table style as a default (GFM) table.
	return (
		<div className="cms-table-scroll">
			<table className={["cms-table", style?.width ? null : "cms-table-full"].filter(Boolean).join(" ")} style={style}>
				{widths.length > 0 && columns > 0 ? (
					<colgroup>
						{known.map((width, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the column position is the identifier.
							<col key={index} style={width ? { width } : undefined} />
						))}
					</colgroup>
				) : null}
				{hasHead ? <thead>{head}</thead> : null}
				<tbody>{body}</tbody>
			</table>
		</div>
	);
};

const TableRow = ({ children }: TableRowProps) => <tr>{children}</tr>;

const TableCell = ({
	as: Tag,
	scope,
	colSpan,
	rowSpan,
	align,
	firstColumn,
	lastColumn,
	inHead,
	children,
}: TableCellProps) => {
	const classes = [
		"cms-table-cell",
		inHead && "cms-table-cell-head",
		firstColumn && "cms-table-cell-first",
		lastColumn && "cms-table-cell-last",
		Tag === "th" && "cms-table-cell-header",
		align ? `cms-align-${align}` : null,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<Tag
			colSpan={colSpan > 1 ? colSpan : undefined}
			rowSpan={rowSpan > 1 ? rowSpan : undefined}
			scope={Tag === "th" ? scope : undefined}
			className={classes}
		>
			{children}
		</Tag>
	);
};

// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output (`katex.renderToString`) is the only HTML the renderer injects
const MathBlock = ({ html }: MathProps) => <div className="cms-math" dangerouslySetInnerHTML={{ __html: html }} />;

const FootnoteRef = ({ index, refId, targetId }: FootnoteRefProps) => (
	<sup>
		<a href={`#${targetId}`} id={refId} data-footnote-ref="true" aria-describedby="footnote-label">
			{index}
		</a>
	</sup>
);

const Footnotes = ({ items, ctx }: FootnotesProps) => (
	<section data-footnotes="true" className="footnotes">
		<h2 className="sr-only" id="footnote-label">
			{ctx.labels.footnotes}
		</h2>
		<ol>
			{items.map((item) => (
				<li key={item.id} id={item.id}>
					{item.children}
				</li>
			))}
		</ol>
	</section>
);

const Link = ({ href, title, children }: LinkProps) => (
	<CmsLink href={href ?? ""} title={title}>
		{children}
	</CmsLink>
);

const mark = (Tag: "strong" | "em" | "del" | "u" | "sup" | "sub" | "code") => {
	const Component = ({ children }: MarkProps) => <Tag>{children}</Tag>;
	Component.displayName = `Cms${Tag}`;
	return Component;
};

/** Translation note text is not shown on the public page (the pre-publish check blocks publishing while it remains). */
const Untranslated = (_: MarkProps) => null;

/** What an unknown node renders to: its content (a container) or nothing (a leaf). In development it leaves a hidden marker. */
const Fallback = ({ node, children }: UnknownProps) => (
	<>
		{process.env.NODE_ENV !== "production" ? <span data-cms-unknown={node.type} hidden /> : null}
		{children ?? null}
	</>
);

const marks = {
	link: Link,
	bold: mark("strong"),
	italic: mark("em"),
	strike: mark("del"),
	underline: mark("u"),
	superscript: mark("sup"),
	subscript: mark("sub"),
	code: mark("code"),
	untranslated: Untranslated,
} satisfies CoreMarkComponents;

/** The core default components. `fold` needs the label, so the table is made per render. */
export const defaultDocumentComponents = (showFoldedCode: string): LooseDocumentComponents => ({
	paragraph: Paragraph,
	heading: Heading,
	list: List,
	listItem: ListItem,
	blockquote: Blockquote,
	horizontalRule: HorizontalRule,
	hardBreak: HardBreak,
	codeBlock: CodeBlock,
	image: Image,
	file: File,
	textAlign: TextAlign,
	table: Table,
	tableRow: TableRow,
	tableCell: TableCell,
	math: MathBlock,
	footnoteRef: FootnoteRef,
	footnotes: Footnotes,
	marks,
	blocks: {},
	codeTags: {
		collapse: CmsCodeCollapse as ComponentType<{ children?: ReactNode }>,
		fold: ({ children, open }: { children?: ReactNode; open?: boolean }) => (
			<CmsCodeFold open={open} label={showFoldedCode}>
				{children}
			</CmsCodeFold>
		),
	},
	fallback: Fallback,
});
