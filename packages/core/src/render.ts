import type { AnyBlockDefinition, MarkDefinition } from "./body/blocks";
import type { Block, Doc, Inline, Mark } from "./body/doc";
import { linkedGroup } from "./body/links";
import { ImageCropShape, ImageRotateShape, imageFrame } from "./media/frame";

/**
 * The site's element factory: React's `createElement`, or any function of that shape. The core knows no framework, so the site hands it in (doc
 * 03, decisions).
 */
export type CreateElement<Node> = (
	type: unknown,
	props: Record<string, unknown> | null,
	...children: unknown[]
) => Node;

/** What a block's `Site` component gets: the block and its attrs, with its text or child blocks already drawn as `children`. */
export type BlockProps = { block: Block; attrs: Record<string, unknown> };
/** What a mark's `Site` component gets: the mark, with the text it wraps as `children`. */
export type MarkProps = { mark: Mark };

export type RenderOptions<Node> = {
	createElement: CreateElement<Node>;
	/** The site's block definitions, the same ones its `monti.config.ts` gives the admin. Core blocks without one are drawn as plain HTML. */
	blocks?: AnyBlockDefinition[];
	marks?: MarkDefinition[];
	/** The address of a media file (doc 09) for image and file blocks; the media id itself when left out. */
	mediaUrl?: (id: string) => string;
	/** A media file's size (the reader's `media`): without it a cropped or turned picture is drawn whole. */
	mediaSize?: (id: string) => { width: number | null; height: number | null } | undefined;
	/**
	 * The path of a linked entry (`monti:entry/<group>`), from the reader's `linkPaths`. A link to an entry with no path (not published) is drawn as
	 * its text alone.
	 */
	entryPath?: (group: string) => string | undefined;
};

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

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
	const media = (id: unknown) => (options.mediaUrl ? options.mediaUrl(String(id)) : String(id));

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
			if (Site) return h(Site, { ...props, mark }, inner);
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
				return h(`h${Number(attrs.level ?? 2)}`, { key, style: aligned }, ...inner);
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
				return h(
					"pre",
					{ key },
					h("code", { className: attrs.language ? `language-${attrs.language}` : undefined }, ...inner),
				);
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
				// A decorative picture says nothing, whatever alt text it once had (doc 09).
				const alt = attrs.decorative === true ? "" : (text(attrs.alt) ?? "");
				const size = options.mediaSize?.(String(attrs.media));
				const frame = imageFrame({
					width: size?.width,
					height: size?.height,
					crop: ImageCropShape.safeParse(attrs.crop).data,
					rotate: ImageRotateShape.safeParse(attrs.rotate).data,
				});
				const image = frame
					? h(
							"span",
							{
								style: {
									display: "block",
									position: "relative",
									overflow: "hidden",
									aspectRatio: frame.aspectRatio,
									...(attrs.width ? { width: attrs.width } : {}),
								},
							},
							h("img", {
								src: media(attrs.media),
								alt,
								style: {
									position: "absolute",
									maxWidth: "none",
									left: `${frame.image.left}%`,
									top: `${frame.image.top}%`,
									width: `${frame.image.width}%`,
									height: `${frame.image.height}%`,
									transform: `translate(-50%, -50%) rotate(${frame.image.rotate}deg)`,
								},
							}),
						)
					: h("img", { src: media(attrs.media), alt, width: attrs.width ?? undefined });
				return attrs.caption
					? h("figure", { key }, image, h("figcaption", null, text(attrs.caption)))
					: h("figure", { key }, image);
			}
			case "file":
				return h("a", { key, href: media(attrs.media), download: true }, text(attrs.name) ?? String(attrs.media));
		}
		return undefined;
	};

	const draw = (block: Block): Node | null => {
		const inner = block.children
			? block.children.map(draw).filter((node) => node !== null)
			: (block.content ?? []).map(inline);
		const Site = blocks.get(block.type)?.Site;
		if (Site) return h(Site, { key: block.id, block, attrs: block.attrs ?? {} }, ...inner);
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
