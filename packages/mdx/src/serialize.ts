import type { BlockDefinition, Site } from "@monti-cms/core/client";
import { type CodeBlockDocument, fromCodeBlockDocumentToCodeFence } from "@monti-cms/core/code-block";
import {
	type CmsJsonValue,
	type CmsMark,
	type CmsNode,
	entryIdOfMark,
	entryLinkHref,
	formatTableWidths,
	hasNonGfmHeaderLayout,
	tableHasMergedCells,
	tableWidths,
} from "@monti-cms/core/document";
import { serializeFrontmatter } from "./frontmatter";
import { jsxRegistryOf } from "./registry";
import type { SerializeContext, SerializeInlinesOptions, SyntaxExtension } from "./syntax/types";
import { NO_SYNTAX, siteCodeLineEffects, siteSyntaxBlocks } from "./syntax-config";

/**
 * The standard serializer: CommonMark + GFM + standard MDX JSX. Anything a syntax extension (`mdx({ syntax })`) writes differently is offered to the
 * extensions first (`fromDocument`, `fromMark`, `escapeText`); what they defer on is written here.
 */

/** A table GFM cannot express (merged cells, column widths, a non-GFM header layout) is written as a JSX table. */
const needsJsxTable = (node: CmsNode) =>
	tableHasMergedCells(node) || hasNonGfmHeaderLayout(node) || formatTableWidths(tableWidths(node)) !== "";

const isIdent = (value: string) => /^[A-Za-z_][\w]*$/.test(value);

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Escapes `&` that would be read back as a character reference (`&amp;` in a URL or title is literal text, not `&`). */
const escapeReferences = (value: string) => value.replace(/&(?=#?\w+;)/g, "\\&");

const hasBalancedParens = (value: string) => {
	let depth = 0;
	for (const char of value) {
		if (char === "(") depth += 1;
		else if (char === ")" && --depth < 0) return false;
	}
	return depth === 0;
};

/**
 * Link destination. A bare destination cannot hold whitespace, control characters, a leading `<`, a backslash or unbalanced parentheses,
 * so those are written in the angle-bracket form (`<...>`), where only `\`, `<`, `>` and line breaks need care.
 */
const formatLinkDestination = (href: string): string => {
	const bare = !/[\s\p{Cc}<\\]/u.test(href) && hasBalancedParens(href);
	if (bare) return escapeReferences(href);
	const escaped = href.replace(/\\/g, "\\\\").replace(/[<>]/g, "\\$&").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
	return `<${escapeReferences(escaped)}>`;
};

/** Link title in double quotes. A blank line cannot appear in a title, so it is collapsed to a single line break. */
const formatLinkTitle = (title: string): string =>
	`"${escapeReferences(
		title
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			.replace(/\r?\n([ \t]*\r?\n)+/g, "\n"),
	)}"`;

const fenceTicks = (value: string) => {
	const runs = value.match(/`+/g)?.map((run) => run.length) ?? [];
	return Math.max(3, ...runs.map((size) => size + 1), 3);
};

const serializeFence = (language: string, meta: string, value: string) => {
	const ticks = "`".repeat(fenceTicks(value));
	const info = [language, meta].filter((part) => part.length > 0).join(" ");
	return `${ticks}${info}\n${value}\n${ticks}`;
};

const serializeJsValue = (value: CmsJsonValue): string => {
	if (value === null) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(serializeJsValue).join(", ")}]`;
	const entries = Object.entries(value).map(([key, item]) => {
		const printedKey = isIdent(key) ? key : JSON.stringify(key);
		return `${printedKey}: ${serializeJsValue(item)}`;
	});
	return `{${entries.join(", ")}}`;
};

const serializeJsxAttribute = (attribute: Record<string, CmsJsonValue>): string => {
	if (attribute.spread) {
		const expression = typeof attribute.expression === "string" ? attribute.expression : "...";
		return `{${expression}}`;
	}
	const name = typeof attribute.name === "string" ? attribute.name : "";
	if (!name) return "";
	if (attribute.expression != null && attribute.value === undefined) {
		return `${name}={${attribute.expression}}`;
	}
	const value = attribute.value;
	if (value === undefined) return name;
	if (typeof value === "string") return `${name}="${escapeAttr(value)}"`;
	return `${name}={${serializeJsValue(value)}}`;
};

const reservedAttrKeys = new Set([
	"name",
	"attributes",
	"language",
	"meta",
	"value",
	"codeDocument",
	"frontmatter",
	"level",
	"src",
	"alt",
	"href",
	"title",
	"checked",
	"start",
]);

const serializeJsxAttrs = (node: CmsNode): string => {
	const attributes = node.attrs?.attributes;
	const parts: string[] = [];
	if (Array.isArray(attributes)) {
		for (const item of attributes) {
			if (!item || typeof item !== "object" || Array.isArray(item)) continue;
			const printed = serializeJsxAttribute(item);
			if (printed) parts.push(printed);
		}
	} else if (node.attrs) {
		for (const [key, value] of Object.entries(node.attrs)) {
			if (reservedAttrKeys.has(key)) continue;
			parts.push(serializeJsxAttribute({ name: key, value }));
		}
	}
	return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const jsxName = (node: CmsNode): string => {
	if (typeof node.attrs?.name === "string" && node.attrs.name.length > 0) return node.attrs.name;
	return node.type;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A JSX spread attribute cannot be expressed in another notation → it stays raw JSX (no silent loss). */
const hasSpread = (node: CmsNode): boolean =>
	Array.isArray(node.attrs?.attributes) && node.attrs.attributes.some((item) => isRecord(item) && Boolean(item.spread));

const markKey = (mark: CmsMark) => `${mark.type}:${JSON.stringify(mark.attrs ?? null)}`;

/**
 * Attributes of an added text decoration (`name="value"`). Writes the definition's attributes in definition order. Required attributes (`required`) are written even if empty,
 * and the others only when they have a value. A boolean writes only the name when true.
 */
const markAttributeList = (block: BlockDefinition, mark: CmsMark): string[] =>
	Object.entries(block.attributes).flatMap(([name, attribute]) => {
		const value = mark.attrs?.[name];
		if (attribute.type === "boolean") return value === true || value === "true" ? [name] : [];
		if (typeof value === "string" && value !== "") return [`${name}="${escapeAttr(value)}"`];
		return attribute.required ? [`${name}="${escapeAttr(value == null ? "" : String(value))}"`] : [];
	});

/**
 * Attributes of a block node (`name="value"`). Writes attributes in the definition's order, and does not drop attributes missing from the definition by appending them.
 * A boolean writes only the name when true and is omitted when false.
 */
const nodeAttributeList = (node: CmsNode, block: BlockDefinition): string[] => {
	const attrs = node.attrs ?? {};
	const parts: string[] = [];
	const done = new Set<string>();

	const print = (name: string, value: CmsJsonValue | undefined) => {
		if (done.has(name)) return;
		done.add(name);
		if (block.attributes[name]?.type === "boolean") {
			// Missing attributes and false are not written. The name is written only when true.
			if (value === undefined || value === null || value === false || value === "false") return;
			parts.push(name);
			return;
		}
		if (name === "rotate" && (value === "0" || value === 0 || value === "" || value === undefined || value === null)) {
			return;
		}
		if (name === "crop" && (value === "" || value === "0,0,100,100" || value === undefined || value === null)) {
			return;
		}
		if (name === "title" && (value === "" || value === undefined || value === null)) {
			return;
		}
		if (value === undefined || value === null) return;
		parts.push(`${name}="${escapeAttr(String(value))}"`);
	};

	for (const name of Object.keys(block.attributes)) print(name, attrs[name]);
	for (const [name, value] of Object.entries(attrs)) {
		if (reservedAttrKeys.has(name)) continue;
		print(name, value);
	}

	return parts;
};

const attrString = (parts: string[]) => (parts.length > 0 ? ` ${parts.join(" ")}` : "");

/**
 * A line break: `hardBreak`, the one shape the parser reads every notation into. It is always written as `<br />`.
 * A `br` element that holds attributes or content is not a break (it is a plain `mdxJsx` node), so it is written as it was read and nothing is lost.
 */
const isLineBreak = (node: CmsNode): boolean => node.type === "hardBreak";

/** A paragraph with nothing to show: no content, empty text, or only line breaks. It is a blank line (see `serializeParagraph`). */
const isBlankParagraph = (node: CmsNode): boolean =>
	node.type === "paragraph" &&
	(node.content ?? []).every((child) => isLineBreak(child) || (child.type === "text" && !child.text));

/** The writer of a site: the standard serializer over the site's blocks, mark order and code fence rules, with the syntax extensions it is given. */
const writerOf = (site: Site, syntax: readonly SyntaxExtension[]) => {
	const { BLOCK_JSX_NAMES, INLINE_JSX_MARKS } = jsxRegistryOf(site);
	const catalog = siteSyntaxBlocks(site);
	const lineEffects = siteCodeLineEffects(site);

	const sortedMarks = (marks: CmsMark[] | undefined): CmsMark[] => site.sortMarks(marks ?? []);

	const escapeText = (value: string, inCode: boolean, inLabel = false, marks: readonly CmsMark[] = []) => {
		if (inCode) return value;
		const escaped = value
			.replace(/\\/g, "\\\\")
			.replace(/`/g, "\\`")
			.replace(/\*/g, "\\*")
			.replace(/_/g, "\\_")
			.replace(/\[/g, "\\[")
			.replace(/\{/g, "\\{")
			.replace(/</g, "\\<");
		const context = serializeContext("", inLabel, marks);
		const extended = syntax.reduce((text, extension) => extension.escapeText?.(text, context) ?? text, escaped);
		// A label closes with `]` (link text, alt text, a label an extension writes), so `]` is escaped inside one (if brackets are unbalanced, the label breaks).
		return inLabel ? extended.replace(/\]/g, "\\]") : extended;
	};

	const serializeContext = (indent = "", label = false, marks: readonly CmsMark[] = []): SerializeContext => ({
		blocks: catalog,
		codeLineEffects: lineEffects,
		indent,
		label,
		marks,
		serializeBlocks: (nodes, at = "") => serializeBlocks([...nodes], at),
		serializeInlines: (nodes: readonly CmsNode[], options: SerializeInlinesOptions = {}) =>
			serializeInlines([...nodes], false, options.label ?? false),
		componentName: jsxName,
		hasSpread,
		nodeAttributes: nodeAttributeList,
		markAttributes: (mark, block) => markAttributeList(block, mark),
		escapeAttribute: escapeAttr,
	});

	/** Offers a node to the extensions in precedence order. The first writer that does not defer wins. */
	const fromExtensions = (node: CmsNode, indent: string): string | undefined => {
		if (syntax.length === 0) return undefined;
		// A Markdown image is not offered: only an image that needs more than Markdown can say.
		if (node.type === "image" && !isRichImage(node)) return undefined;
		const context = serializeContext(indent);
		for (const extension of syntax) {
			const writers = extension.fromDocument;
			if (!writers) continue;
			const specific = Object.hasOwn(writers, node.type) ? writers[node.type] : undefined;
			const written =
				specific?.(node, context) ?? (Object.hasOwn(writers, "*") ? writers["*"]?.(node, context) : undefined);
			if (written !== undefined) return written;
		}
		return undefined;
	};

	/** The block definition a node is written from as standard JSX (a container, leaf or text block). The line break is a plain `<br />`. */
	const standardBlock = (node: CmsNode): BlockDefinition | undefined => {
		if (hasSpread(node)) return undefined;
		const block = catalog.byComponent(jsxName(node));
		if (!block || block.component === "br") return undefined;
		const kind = block.syntax.kind;
		return kind === "container" || kind === "leaf" || kind === "text" ? block : undefined;
	};

	/** A block as standard JSX: `<Name attrs>…</Name>` (containers hold blocks, text blocks hold inlines) or `<Name attrs />`. */
	const serializeBlockJsx = (node: CmsNode, block: BlockDefinition, indent: string): string => {
		const name = block.component;
		const attrs = attrString(nodeAttributeList(node, block));
		const content = node.content ?? [];
		if (block.syntax.kind === "text") {
			const inner = serializeInlines(content);
			return inner ? `${indent}<${name}${attrs}>${inner}</${name}>` : `${indent}<${name}${attrs} />`;
		}
		const inner = block.syntax.kind === "container" ? serializeBlocks(content, "") : "";
		if (!inner) return `${indent}<${name}${attrs} />`;
		return `${indent}<${name}${attrs}>\n\n${inner}\n\n${indent}</${name}>`;
	};

	/**
	 * CommonMark emphasis delimiters do not open or close if the first/last inner character is whitespace or punctuation
	 * (`**정적(Static)**과` is not emphasis; the asterisks stay as text). Only in that case is JSX written.
	 */
	const EMPHASIS_UNSAFE_EDGE = /^[\s\p{P}\p{S}]|[\s\p{P}\p{S}]$/u;

	const EMPHASIS_DELIMITERS: Record<string, { markdown: string; tag: string }> = {
		bold: { markdown: "**", tag: "strong" },
		italic: { markdown: "*", tag: "em" },
		strike: { markdown: "~~", tag: "del" },
	};

	const markTag = (tag: string, attrs: string[], inner: string) => `<${tag}${attrString(attrs)}>${inner}</${tag}>`;

	/** A mark in the standard notation: Markdown where it holds, otherwise JSX. */
	const standardMark = (mark: CmsMark, inner: string): string => {
		const emphasis = EMPHASIS_DELIMITERS[mark.type];
		if (emphasis) {
			if (inner.length === 0 || EMPHASIS_UNSAFE_EDGE.test(inner)) return markTag(emphasis.tag, [], inner);
			return `${emphasis.markdown}${inner}${emphasis.markdown}`;
		}
		switch (mark.type) {
			case "underline":
				return markTag("u", [], inner);
			case "superscript":
				return markTag("sup", [], inner);
			case "subscript":
				return markTag("sub", [], inner);
			case "untranslated":
				return markTag("Untranslated", [], inner);
			case "code":
				return `\`${inner}\``;
			case "link": {
				// An entry link has no address of its own: a text notation names the entry (`entry:<id>`), unless the editor gave it an address to show.
				const entryId = entryIdOfMark(mark);
				const href = String(mark.attrs?.href ?? (entryId ? entryLinkHref(entryId) : ""));
				const title = mark.attrs?.title;
				const destination = formatLinkDestination(href);
				return typeof title === "string" && title.length > 0
					? `[${inner}](${destination} ${formatLinkTitle(title)})`
					: `[${inner}](${destination})`;
			}
			default: {
				// An added text decoration (block extension). The mark name is the block name.
				const block = catalog.byName(mark.type);
				if (block?.syntax.kind === "text") return markTag(block.component, markAttributeList(block, mark), inner);
				return inner;
			}
		}
	};

	/** Writes a mark around its already written content: the extensions first, then the standard notation. */
	const writeMark = (mark: CmsMark, inner: string): string => {
		if (syntax.length > 0) {
			const context = serializeContext();
			for (const extension of syntax) {
				const writers = extension.fromMark;
				if (!writers) continue;
				const specific = Object.hasOwn(writers, mark.type) ? writers[mark.type] : undefined;
				const written =
					specific?.(mark, inner, context) ??
					(Object.hasOwn(writers, "*") ? writers["*"]?.(mark, inner, context) : undefined);
				if (written !== undefined) return written;
			}
		}
		return standardMark(mark, inner);
	};

	/** A footnote label cannot hold whitespace, brackets, a backslash or a caret, so those are replaced when a document carries one. */
	const footnoteLabel = (node: CmsNode): string => String(node.attrs?.label ?? "").replace(/[\s[\]\\^]/g, "-");

	const serializeFootnoteDefinition = (node: CmsNode, indent: string): string => {
		const lines = serializeBlocks(node.content ?? [], "").split("\n");
		// Continuation lines are indented by four spaces (GFM); blank lines stay empty.
		const body = lines.map((line, index) => (index === 0 || line.length === 0 ? line : `    ${line}`));
		const head = `[^${footnoteLabel(node)}]:`;
		if (lines.length === 1 && lines[0] === "") return `${indent}${head}`;
		return [`${head} ${body[0]}`, ...body.slice(1)].map((line) => (line ? indent + line : line)).join("\n");
	};

	/** An image with a media reference, size, alignment, caption, crop, rotation or decorative flag cannot be a Markdown image. */
	const isRichImage = (node: CmsNode): boolean => {
		const crop = node.attrs?.crop ? String(node.attrs.crop) : undefined;
		const rotate = node.attrs?.rotate ? String(node.attrs.rotate) : undefined;
		return Boolean(
			node.attrs?.mediaId ||
				node.attrs?.width ||
				node.attrs?.align ||
				node.attrs?.caption ||
				node.attrs?.decorative === true ||
				node.attrs?.decorative === "true" ||
				(crop && crop !== "0,0,100,100") ||
				(rotate && rotate !== "0"),
		);
	};

	const serializeImage = (node: CmsNode, indent = ""): string => {
		// A rich image is stored as an `Image` element (or whatever an extension writes); otherwise as a Markdown image.
		if (isRichImage(node)) {
			const written = fromExtensions(node, indent);
			if (written !== undefined) return written;
			const block = catalog.byComponent("Image");
			if (block) return `${indent}<Image${attrString(nodeAttributeList(node, block))} />`;
		}

		const src = node.attrs?.src ? String(node.attrs.src) : "";
		const alt = node.attrs?.alt ? String(node.attrs.alt) : "";
		const title = node.attrs?.title;
		// The alt text sits where link text does, so it is escaped as a label (`]` closes it, `*` and `[` would be read as markup).
		const label = escapeReferences(escapeText(alt, false, true));
		const destination = formatLinkDestination(src);
		if (typeof title === "string" && title.length > 0)
			return `${indent}![${label}](${destination} ${formatLinkTitle(title)})`;
		return `${indent}![${label}](${destination})`;
	};

	const encodeLeadingSpaces = (
		value: string,
		inCode: boolean,
		inLabel = false,
		marks: readonly CmsMark[] = [],
	): string => {
		const match = /^[ \t]+/.exec(value);
		if (!match) return escapeText(value, inCode, inLabel, marks);
		return `${"&#x20;".repeat(match[0].replace(/\t/g, " ").length)}${escapeText(value.slice(match[0].length), inCode, inLabel, marks)}`;
	};

	/**
	 * Escapes what would make the start of a paragraph line a different block. If a line starts with `1. `, it is read as an ordered list on re-parse, so the list marker is escaped.
	 * However, the backslash goes before the period, not the digit (`1\. `). `\1. ` escapes the digit and stays literal.
	 */
	const escapeLineStart = (line: string): string =>
		line
			.replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3")
			.replace(/^(\s*)([>#]|-{1,3}\s|\*{1,3}\s|```)/, "$1\\$2")
			// A line of only `-` or `=` under text would turn the paragraph into a heading (or the line into a thematic break).
			.replace(/^(\s*)([-=])(?=[-=]*\s*$)/, "$1\\$2");

	const BREAK = "<br />";

	/**
	 * A paragraph. A blank paragraph (the editor makes one when Enter is pressed between blocks) is one line of only `<br />`, which reads back as one blank
	 * paragraph, so any number of them survive a save. A paragraph of only line breaks counts as one blank line per break (at least one).
	 */
	const serializeParagraph = (node: CmsNode, indent: string, lineIndent = indent): string => {
		if (!isBlankParagraph(node)) return indent + serializeInlines(node.content ?? [], true, false, lineIndent);
		const breaks = (node.content ?? []).filter(isLineBreak).length;
		return Array.from({ length: Math.max(breaks, 1) }, () => `${indent}${BREAK}`).join("\n\n");
	};

	/**
	 * Writes inline nodes. `asParagraph` is set for the text of a paragraph: block markers at the start of a line are escaped, and a line break is followed by a line ending
	 * (`line<br />` + newline + `next`) so the source reads well; `lineIndent` is the indentation of those following lines. Everywhere else (headings, table cells, labels)
	 * a line break stays inline.
	 */
	const serializeInlines = (nodes: CmsNode[], asParagraph = false, inLabel = false, lineIndent = ""): string => {
		const out: string[] = [];
		// Lines finished by a line break (a paragraph only). Marks never span a line break (they are closed before it), so `out` can start over.
		const lines: string[] = [];
		// For each open mark, remember the position of the piece where its content starts. On closing, the content is cut out and written wrapped by the mark.
		const active: { mark: CmsMark; contentIndex: number }[] = [];
		let atLineStart = asParagraph;
		// The current line has content before a line break, so a line ending after the break is safe (a line of only `<br />` would be read as a block).
		let contentOnLine = false;
		let newlinePending = false;

		const closeEntry = (entry: { mark: CmsMark; contentIndex: number }) => {
			const inner = out.splice(entry.contentIndex).join("");
			out.push(writeMark(entry.mark, inner));
		};

		const closeTo = (index: number) => {
			while (active.length > index) {
				const entry = active.pop();
				if (entry) closeEntry(entry);
			}
		};

		/** Starts a new line after a line break, if the node about to be written is plain text. */
		const startLine = (node: CmsNode) => {
			if (newlinePending && node.type === "text") {
				lines.push(out.splice(0).join(""));
				atLineStart = true;
				contentOnLine = false;
			}
			newlinePending = false;
		};

		for (const node of nodes) {
			if (isLineBreak(node)) {
				// A line break is always `<br />`: `\` + newline and two trailing spaces are read but not written.
				closeTo(0);
				out.push(BREAK);
				newlinePending = asParagraph && (newlinePending || contentOnLine);
				atLineStart = false;
				continue;
			}
			startLine(node);
			if (node.type === "image") {
				closeTo(0);
				out.push(serializeImage(node));
				contentOnLine = true;
				continue;
			}
			if (node.type === "footnoteReference") {
				closeTo(0);
				out.push(`[^${footnoteLabel(node)}]`);
				atLineStart = false;
				contentOnLine = true;
				continue;
			}
			if (node.type !== "text") {
				const written = fromExtensions(node, "");
				if (written !== undefined) {
					closeTo(0);
					out.push(written);
					contentOnLine = true;
					continue;
				}
				const block = standardBlock(node);
				if (block) {
					closeTo(0);
					out.push(serializeBlockJsx(node, block, ""));
					contentOnLine = true;
					continue;
				}
				if (node.type === "mdxJsx" || BLOCK_JSX_NAMES.has(node.type) || INLINE_JSX_MARKS[node.type]) {
					closeTo(0);
					out.push(serializeJsx(node));
					contentOnLine = true;
					continue;
				}
				if (node.type === "mdxExpression") {
					closeTo(0);
					out.push(`{${String(node.attrs?.value ?? "")}}`);
					contentOnLine = true;
					continue;
				}
				closeTo(0);
				if (node.content) out.push(serializeInlines(node.content, false, inLabel));
				else if (node.text) out.push(escapeText(node.text, false, inLabel));
				contentOnLine = true;
				continue;
			}

			const wanted = sortedMarks(node.marks);
			let same = 0;
			while (
				same < active.length &&
				same < wanted.length &&
				markKey(active[same]?.mark ?? { type: "" }) === markKey(wanted[same] ?? { type: "" })
			) {
				same += 1;
			}
			closeTo(same);
			for (let index = same; index < wanted.length; index += 1) {
				const mark = wanted[index];
				if (mark) active.push({ mark, contentIndex: out.length });
			}
			const inCode = wanted.some((mark) => mark.type === "code");
			const text = node.text ?? "";
			// Link text closes with `]`, like a label, so a `]` inside it is escaped too.
			const escapeClosingBracket = inLabel || wanted.some((mark) => mark.type === "link");
			out.push(
				atLineStart && !inCode
					? encodeLeadingSpaces(text, inCode, escapeClosingBracket, wanted)
					: escapeText(text, inCode, escapeClosingBracket, wanted),
			);
			atLineStart = false;
			contentOnLine = true;
		}
		closeTo(0);

		const last = out.join("");
		if (!asParagraph) return last;
		return [...lines, last]
			.map((line, index) => (index === 0 ? "" : `\n${lineIndent}`) + escapeLineStart(line))
			.join("");
	};

	const serializeCodeBlock = (node: CmsNode, indent: string): string => {
		const attrs = node.attrs ?? {};
		let language = typeof attrs.language === "string" ? attrs.language : "";
		let meta = typeof attrs.meta === "string" ? attrs.meta : "";
		let value = typeof attrs.value === "string" ? attrs.value : "";

		if (value.length === 0 && attrs.codeDocument && typeof attrs.codeDocument === "object") {
			const fence = fromCodeBlockDocumentToCodeFence(
				attrs.codeDocument as unknown as CodeBlockDocument,
				site.annotationConfig,
			);
			language = fence.lang ?? language;
			meta = fence.meta ?? meta;
			value = fence.value;
		}

		const fence = serializeFence(language, meta, value);
		if (!indent) return fence;
		return fence
			.split("\n")
			.map((line) => indent + line)
			.join("\n");
	};

	const serializeJsx = (node: CmsNode, indent = ""): string => {
		const name = jsxName(node);
		const attrs = serializeJsxAttrs(node);
		const inner = serializeBlocks(node.content ?? [], "");
		if (!inner) return `${indent}<${name}${attrs} />`;
		return `${indent}<${name}${attrs}>\n\n${inner}\n\n${indent}</${name}>`;
	};

	const serializeList = (node: CmsNode, indent: string, ordered: boolean): string => {
		const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
		return (node.content ?? [])
			.map((item, index) => {
				const checked = item.attrs?.checked;
				const task = typeof checked === "boolean" ? `[${checked ? "x" : " "}] ` : "";
				const marker = ordered ? `${start + index}. ${task}` : `- ${task}`;
				return serializeListItem(item, marker, indent);
			})
			.join("\n");
	};

	const serializeListItem = (item: CmsNode, marker: string, indent: string): string => {
		const blocks = item.content ?? [];
		const innerIndent = indent + " ".repeat(Math.max(marker.length, 2));
		if (blocks.length === 0) return `${indent}${marker}`.trimEnd();

		const [first, ...rest] = blocks;
		let head = `${indent}${marker}`;
		if (first?.type === "paragraph") {
			// An empty first paragraph is an empty item (`- `), which is what the editor makes for a new bullet.
			if (!isBlankParagraph(first)) head += serializeInlines(first.content ?? [], true, false, innerIndent);
		} else if (first) {
			head += `\n${serializeBlock(first, innerIndent)}`;
		}

		const extra = rest.map((block) => {
			if (block.type === "paragraph") return serializeParagraph(block, innerIndent);
			return serializeBlock(block, innerIndent);
		});
		// If a listItem has several blocks (loose list), they must be separated by blank lines to keep paragraph boundaries.
		// Joining them on one line would merge them into one paragraph on re-parse and lose the paragraph structure.
		return [head, ...extra].join("\n\n");
	};

	const serializeGfmTable = (node: CmsNode): string => {
		const rows = node.content ?? [];
		const serializedRows = rows.map((row) => {
			const cells = (row.content ?? []).map((cell) => serializeInlines(cell.content ?? []).replace(/\|/g, "\\|"));
			return `| ${cells.join(" | ")} |`;
		});
		if (serializedRows.length === 0) return "";
		const columnCount = rows[0]?.content?.length ?? 1;
		const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
		const rule = (value: unknown) =>
			value === "left" ? ":--" : value === "center" ? ":-:" : value === "right" ? "--:" : "---";
		const separator = `| ${Array.from({ length: columnCount }, (_, index) => rule(align[index])).join(" | ")} |`;
		const [header, ...body] = serializedRows;
		return [header, separator, ...body].join("\n");
	};

	const tableCellAttrs = (cell: CmsNode): string[] => {
		const attrs: string[] = [];
		if (cell.attrs?.header === true || cell.attrs?.header === "true") attrs.push("header");
		const colspan = Number(cell.attrs?.colspan ?? 1);
		if (colspan > 1) attrs.push(`colspan="${colspan}"`);
		const rowspan = Number(cell.attrs?.rowspan ?? 1);
		if (rowspan > 1) attrs.push(`rowspan="${rowspan}"`);
		return attrs;
	};

	/** Collects table attributes (`align`, `widths`) in storage order. */
	const tableAttrs = (node: CmsNode): Array<[string, string]> => {
		const attrs: Array<[string, string]> = [];
		const align = tableAlign(node);
		if (align) attrs.push(["align", align]);
		const widths = formatTableWidths(tableWidths(node));
		if (widths) attrs.push(["widths", widths]);
		return attrs;
	};

	const tableAlign = (node: CmsNode): string => {
		const align = Array.isArray(node.attrs?.align) ? (node.attrs.align as Array<string | null>) : [];
		const value = align.map((v) => v ?? "").join(",");
		return value.replace(/,/g, "").length > 0 ? value : "";
	};

	/** A table GFM cannot express (merged cells, column widths, a non-GFM header layout) as JSX elements. */
	const serializeJsxTable = (node: CmsNode): string => {
		const attrs = tableAttrs(node).map(([name, value]) => ` ${name}="${escapeAttr(value)}"`);
		const lines = [`<Table${attrs.join("")}>`];
		for (const row of node.content ?? []) {
			lines.push("<TableRow>");
			for (const cell of row.content ?? []) {
				const cellAttrs = tableCellAttrs(cell);
				lines.push(
					`<TableCell${cellAttrs.length ? ` ${cellAttrs.join(" ")}` : ""}>${serializeInlines(cell.content ?? [])}</TableCell>`,
				);
			}
			lines.push("</TableRow>");
		}
		lines.push("</Table>");
		return lines.join("\n");
	};

	const serializeTable = (node: CmsNode): string =>
		needsJsxTable(node) ? serializeJsxTable(node) : serializeGfmTable(node);

	const indentLines = (text: string, indent: string): string =>
		text
			.split("\n")
			.map((line) => indent + line)
			.join("\n");

	const serializeBlock = (node: CmsNode, indent = ""): string => {
		const extended = fromExtensions(node, indent);
		if (extended !== undefined) return extended;
		const block = standardBlock(node);
		if (block) return serializeBlockJsx(node, block, indent);

		switch (node.type) {
			case "paragraph":
				return serializeParagraph(node, indent);
			case "heading": {
				const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
				return `${indent}${"#".repeat(level)} ${serializeInlines(node.content ?? [])}`;
			}
			case "codeBlock":
				return serializeCodeBlock(node, indent);
			case "math":
				return `${indent}$$\n${String(node.attrs?.value ?? "")}\n$$`;
			case "bulletList":
				return serializeList(node, indent, false);
			case "orderedList":
				return serializeList(node, indent, true);
			case "table":
				return indentLines(serializeTable(node), indent);
			case "blockquote":
				return serializeBlocks(node.content ?? [], "")
					.split("\n")
					.map((line) => `${indent}>${line ? ` ${line}` : ""}`)
					.join("\n");
			case "footnoteDefinition":
				return serializeFootnoteDefinition(node, indent);
			case "horizontalRule":
				return `${indent}---`;
			case "image":
				return serializeImage(node, indent);
			case "html":
				// Multi-line source (turned-back unregistered directive etc.) must be indented on every line so it is read back as the same block inside a list.
				return String(node.attrs?.value ?? "")
					.split("\n")
					.map((line) => (line ? indent + line : line))
					.join("\n");
			case "mdxEsm":
				return indent + String(node.attrs?.value ?? "");
			case "unparsed":
				// A body that could not be read keeps its text as it was given.
				return String(node.attrs?.source ?? "");
			case "mdxExpression":
				return `${indent}{${String(node.attrs?.value ?? "")}}`;
			case "doc":
				return serializeBlocks(node.content ?? [], indent);
			default:
				if (BLOCK_JSX_NAMES.has(node.type) || node.type === "mdxJsx" || INLINE_JSX_MARKS[node.type]) {
					return serializeJsx(node, indent);
				}
				if (node.content) return serializeBlocks(node.content, indent);
				return "";
		}
	};

	const serializeBlocks = (nodes: CmsNode[], indent = ""): string => {
		// A lone blank paragraph is what the editor puts in an empty container (a callout, a footnote, a quote), not a blank line the author typed: nothing is written for it.
		const only = nodes.length === 1 ? nodes[0] : undefined;
		if (only && isBlankParagraph(only)) return "";
		return nodes
			.map((node) => serializeBlock(node, indent))
			.filter((block) => block.length > 0)
			.join("\n\n");
	};

	return { serializeBlocks };
};

/**
 * Blank lines at the very end of a document are not written. The editor keeps an empty paragraph after a last block that is not a paragraph (so there is
 * somewhere to type), and an empty document is one empty paragraph: writing them would add a blank line to the end of every such page and make an empty body not empty.
 */
const withoutTrailingBlankLines = (nodes: CmsNode[]): CmsNode[] => {
	let end = nodes.length;
	while (end > 0 && isBlankParagraph(nodes[end - 1] as CmsNode)) end -= 1;
	return end === nodes.length ? nodes : nodes.slice(0, end);
};

/**
 * Writes a document as MDX for `site`. The standard notation is CommonMark + GFM + standard MDX JSX; `extensions` (none: standard MDX only)
 * write their own notation first, in precedence order, wherever they do not defer.
 */
export const serialize = (site: Site, doc: unknown, extensions: readonly SyntaxExtension[] = NO_SYNTAX): string => {
	const { serializeBlocks } = writerOf(site, extensions);
	const node = doc as CmsNode;
	const body = serializeBlocks(node.type === "doc" ? withoutTrailingBlankLines(node.content ?? []) : [node]).trimEnd();
	const frontmatter = node.attrs?.frontmatter;
	if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
		return `${serializeFrontmatter(frontmatter)}\n${body}\n`;
	}
	return body.length > 0 ? `${body}\n` : "";
};
