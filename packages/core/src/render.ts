import type { AnyBlockDefinition, MarkDefinition } from "./body/blocks";
import { type Block, type Doc, type Inline, type Mark, walk } from "./body/doc";
import { linkedGroup } from "./body/links";
import { codeLineId, drawCodeBlock } from "./code/draw";
import type { CodeColors } from "./code/highlight";
import { codeBlocksByRef, resolveCodeRef } from "./code/links";
import { imageAlignOf } from "./media/frame";
import { imageFrameStyle, type SiteImage, type SiteMedia, siteImage } from "./media/site-image";

export { imageFrameStyle, type SiteImage, type SiteMedia, siteImage };

/**
 * The site's element factory: React's `createElement`, or any function of that shape. The core knows no framework, so the site hands it in (doc
 * 03, decisions).
 */
export type CreateElement<Node> = (
	type: unknown,
	props: Record<string, unknown> | null,
	...children: unknown[]
) => Node;

/**
 * What a block's `Site` component gets: the block and its attrs, with its text or child blocks already drawn as `children`. An image block's also gets its
 * picture ready to draw (`siteImage`), or `null` when the entry does not have its file.
 */
export type BlockProps = {
	block: Block;
	attrs: Record<string, unknown>;
	image?: SiteImage | null;
	/** A heading's `id`, the one `tocOf` gives for it: the site's own heading component puts it on its element. */
	anchor?: string;
	/** The entry's language (`ko`, `en-US`), when the site gave it: the words a block draws of its own (a callout's kind) are in it. */
	locale?: string;
};
/** What a mark's `Site` component gets: the mark, with the text it wraps as `children`, and the entry's language when the site gave it. */
export type MarkProps = { mark: Mark; locale?: string };

export type RenderOptions<Node> = {
	createElement: CreateElement<Node>;
	/** The site's block definitions, the same ones its `monti.config.ts` gives the admin. Core blocks without one are drawn as plain HTML. */
	blocks?: AnyBlockDefinition[];
	marks?: MarkDefinition[];
	/** The files the body uses (the reader's `media`, doc 09): an image or a file block whose file is not here is not drawn. */
	media?: Readonly<Record<string, SiteMedia>>;
	/**
	 * The path of a linked entry (`monti:entry/<group>`), from the reader's `linkPaths`. A link to an entry with no path (not published) is drawn as
	 * its text alone.
	 */
	entryPath?: (group: string) => string | undefined;
	/** Code colours: the site's `codeHighlighter` (`@monti-cms/core/code`, doc 17). Without it code is drawn in one colour. */
	code?: CodeColors;
	/** The entry's language: handed to the site's block and mark components for the words they draw of their own, and the words the core draws itself (the code block's copy button). */
	locale?: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** A heading in a body's table of contents: `depth` counts from the shallowest level listed (0), so a list can indent by it. */
export type TocItem = { id: string; text: string; level: number; depth: number };

const headingText = (block: Block) =>
	(block.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");

/**
 * The `id` of every heading of a body, by block id (doc 16): its words in lower case with letters and digits of any language, `-` and `_` kept and
 * the rest joined by `-`. The same words again take `-1`, `-2`; no letter at all is `section`. An id never looks like a footnote's (`fn-…`,
 * `fnref-…`): one that would starts with `h-`.
 */
function headingIds(doc: Doc): Map<string, string> {
	const ids = new Map<string, string>();
	const taken = new Set<string>();
	for (const { block } of walk(doc.blocks)) {
		if (block.type !== "heading") continue;
		const words = headingText(block)
			.normalize("NFKC")
			.toLowerCase()
			.replace(/[^\p{L}\p{N}_-]+/gu, "-")
			.replace(/^-+|-+$/g, "");
		const base = /^fn(ref)?-/.test(words) ? `h-${words}` : words || "section";
		let id = base;
		for (let again = 1; taken.has(id); again++) id = `${base}-${again}`;
		taken.add(id);
		ids.set(block.id, id);
	}
	return ids;
}

/**
 * A body's table of contents: its headings from level `min` to `max` (2 and 3 unless said), in order, each with the `id` `renderDocument` puts on
 * it.
 */
export function tocOf(doc: Doc, { min = 2, max = 3 }: { min?: number; max?: number } = {}): TocItem[] {
	const ids = headingIds(doc);
	const listed = [...walk(doc.blocks)]
		.map(({ block }) => block)
		.filter((block) => block.type === "heading")
		.map((block) => ({ block, level: Number(block.attrs?.level ?? 2) }))
		.filter(({ level }) => level >= min && level <= max);
	const top = Math.min(...listed.map(({ level }) => level));
	return listed.map(({ block, level }) => ({
		id: ids.get(block.id) ?? "",
		text: headingText(block),
		level,
		depth: level - top,
	}));
}

const plainMarks: Record<string, string> = {
	bold: "strong",
	italic: "em",
	underline: "u",
	strike: "s",
	code: "code",
	sup: "sup",
	sub: "sub",
};

/**
 * Draws a body on the site (doc 03, "site") with the site's own block components. A block the site does not define (a removed plugin's) is not
 * drawn; outside production it says so in the console. Returns a list of nodes.
 */
export function renderDocument<Node>(doc: Doc, options: RenderOptions<Node>): (Node | string)[] {
	const h = options.createElement;
	const blocks = new Map((options.blocks ?? []).map((block) => [block.type, block]));
	const marks = new Map((options.marks ?? []).map((mark) => [mark.type, mark]));

	// Footnotes are numbered in the order their references come in the text (doc 03, T62).
	const numbers = new Map<string, number>();
	const count = (list: Block[]) => {
		for (const block of list) {
			if (block.type === "footnote") continue;
			for (const part of block.content ?? [])
				if (part.type === "footnoteRef" && !numbers.has(part.id)) numbers.set(part.id, numbers.size + 1);
			if (block.children) count(block.children);
		}
	};
	count(doc.blocks);
	const anchored = new Set<string>();
	const anchors = headingIds(doc);
	const codeBlocks = codeBlocksByRef(doc);

	const inline = (part: Inline, key: number): Node | string => {
		if (part.type === "hardBreak") return h("br", { key });
		if (part.type === "footnoteRef") {
			// The footnote's "↩" goes back to its first reference: only that one carries the id.
			const first = !anchored.has(part.id);
			anchored.add(part.id);
			return h(
				"sup",
				{ key },
				h(
					"a",
					{ href: `#fn-${part.id}`, id: first ? `fnref-${part.id}` : undefined },
					String(numbers.get(part.id) ?? ""),
				),
			);
		}
		const wrapped = (part.marks ?? []).reduceRight<Node | string>((inner, mark, index) => {
			const props = index === 0 ? { key } : null;
			const Site = marks.get(mark.type)?.Site;
			if (Site) return h(Site, { ...props, mark, ...(options.locale ? { locale: options.locale } : {}) }, inner);
			if (mark.type === "codeRef") {
				// A code link goes to its lines (`CodeTools` lights them up); one that goes nowhere is its words (doc 17, 17-8).
				const to = resolveCodeRef(codeBlocks, mark as { block?: string; anchor?: string });
				return to
					? h(
							"a",
							{
								...props,
								href: `#${codeLineId(to.block, to.anchor)}`,
								"data-code-ref": `${to.block} ${to.anchor}`,
							},
							inner,
						)
					: inner;
			}
			if (mark.type === "link") {
				const group = linkedGroup(mark.href);
				const href = group === null ? text(mark.href) : options.entryPath?.(group);
				return href === undefined ? inner : h("a", { ...props, href }, inner);
			}
			const tag = plainMarks[mark.type];
			return tag ? h(tag, props, inner) : inner;
		}, part.text);
		return wrapped;
	};

	/** The plain HTML of a core block with no `Site` component of the site's own. */
	const plain = (block: Block, inner: unknown[]): Node | null | undefined => {
		const attrs = block.attrs ?? {};
		const key = block.id;
		// An aligned paragraph or heading says so in its style (doc 03, the block menu's "align"); left is the default and adds nothing.
		const aligned = attrs.align === "center" || attrs.align === "right" ? { textAlign: attrs.align } : undefined;
		switch (block.type) {
			case "paragraph":
				return h("p", { key, style: aligned }, ...inner);
			case "heading":
				return h(`h${Number(attrs.level ?? 2)}`, { key, id: anchors.get(block.id), style: aligned }, ...inner);
			case "bulletList":
				return h("ul", { key }, ...inner);
			case "orderedList":
				return h("ol", { key, start: attrs.start }, ...inner);
			case "checklist":
				return h("ul", { key, "data-checklist": "" }, ...inner);
			case "listItem":
				return attrs.checked === undefined
					? h("li", { key }, ...inner)
					: h(
							"li",
							{ key },
							h("input", { type: "checkbox", checked: Boolean(attrs.checked), readOnly: true }),
							...inner,
						);
			case "quote":
				return h("blockquote", { key }, ...inner);
			case "codeBlock":
				return drawCodeBlock(h, block, {
					colors: options.code,
					locale: options.locale,
					lineClasses: options.code?.lineClasses,
				});
			case "divider":
				return h("hr", { key });
			case "footnote":
				return h("li", { key, id: `fn-${attrs.id}` }, ...inner, " ", h("a", { href: `#fnref-${attrs.id}` }, "↩"));
			case "table": {
				const [first = [], ...rest] = (attrs.rows as string[][] | undefined) ?? [];
				const row = (cells: string[], cell: string, index: number) =>
					h("tr", { key: index }, ...cells.map((value, at) => h(cell, { key: at }, value)));
				const body = h(
					"tbody",
					null,
					...(attrs.header ? rest : [first, ...rest]).map((cells, index) => row(cells, "td", index)),
				);
				// A table whose columns were sized keeps each column's share of the body, so it narrows with the page.
				const widths = attrs.widths as number[] | undefined;
				const columns = widths?.length
					? h("colgroup", null, ...widths.map((width, at) => h("col", { key: at, style: { width: `${width}%` } })))
					: null;
				return attrs.header
					? h("table", { key }, columns, h("thead", null, row(first, "th", 0)), body)
					: h("table", { key }, columns, body);
			}
			case "image": {
				const image = siteImage(attrs, options.media);
				if (!image) return null;
				// Its own width, or its share of the body; a narrower body shrinks it, and its height follows its shape (doc 09).
				const width = image.widthPercent === null ? `${image.width}px` : `${image.widthPercent}%`;
				const frame = image.frame && imageFrameStyle(image.frame);
				const picture = frame
					? h(
							"span",
							{ style: { ...frame.box, width, maxWidth: "100%" } },
							h("img", { src: image.src, alt: image.alt, style: frame.picture }),
						)
					: h("img", {
							src: image.src,
							alt: image.alt,
							width: image.width,
							height: image.height,
							style: { width, maxWidth: "100%", height: "auto" },
						});
				// In the column where the editor drew it: the middle unless it says otherwise (doc 09).
				const place = {
					style: {
						display: "flex",
						flexDirection: "column",
						alignItems: { left: "flex-start", center: "center", right: "flex-end" }[imageAlignOf(attrs.align)],
					},
				};
				return attrs.caption
					? h("figure", { key, ...place }, picture, h("figcaption", null, text(attrs.caption)))
					: h("figure", { key, ...place }, picture);
			}
			case "file": {
				const file = options.media?.[String(attrs.media)];
				if (!file) return null;
				return h("a", { key, href: file.url, download: true }, text(attrs.name)?.trim() || file.name);
			}
		}
		return undefined;
	};

	const draw = (block: Block): Node | null => {
		const inner = block.children
			? block.children.map(draw).filter((node) => node !== null)
			: (block.content ?? []).map(inline);
		const Site = blocks.get(block.type)?.Site;
		if (Site) {
			const attrs = block.attrs ?? {};
			const props: BlockProps = {
				block,
				attrs,
				...(block.type === "image" ? { image: siteImage(attrs, options.media) } : {}),
				...(block.type === "heading" ? { anchor: anchors.get(block.id) } : {}),
				...(options.locale ? { locale: options.locale } : {}),
			};
			return h(Site, { key: block.id, ...props }, ...inner);
		}
		const drawn = plain(block, inner);
		if (drawn === undefined && process.env.NODE_ENV !== "production")
			console.warn(`Monti: no block definition for "${block.type}" (${block.id}); it is not drawn.`);
		return drawn ?? null;
	};
	// The footnotes go together at the end, under a rule, in the order of their numbers; one no text points at goes last.
	const order = (block: Block) => numbers.get(String(block.attrs?.id)) ?? Number.POSITIVE_INFINITY;
	const notes = doc.blocks.filter((block) => block.type === "footnote").sort((a, b) => order(a) - order(b));
	const drawn = doc.blocks
		.filter((block) => block.type !== "footnote")
		.map(draw)
		.filter((node) => node !== null);
	if (notes.length === 0) return drawn;
	const list = notes.map(draw).filter((node) => node !== null);
	return [...drawn, h("section", { key: "footnotes", "data-footnotes": "" }, h("hr", null), h("ol", null, ...list))];
}
