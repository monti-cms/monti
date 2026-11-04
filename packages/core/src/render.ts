import type { AnyBlockDefinition, MarkDefinition } from "./body/blocks";
import type { Block, Doc, Inline, Mark } from "./body/doc";
import { linkedGroup } from "./body/links";

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

	const inline = (part: Inline, key: number): Node | string => {
		if (part.type === "hardBreak") return h("br", { key });
		if (part.type === "footnoteRef")
			return h("sup", { key }, h("a", { href: `#fn-${part.id}`, id: `fnref-${part.id}` }, part.id));
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
		switch (block.type) {
			case "paragraph":
				return h("p", { key }, ...inner);
			case "heading":
				return h(`h${Number(attrs.level ?? 2)}`, { key }, ...inner);
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
				return h("p", { key, id: `fn-${attrs.id}` }, ...inner);
			case "table": {
				const [first = [], ...rest] = (attrs.rows as string[][] | undefined) ?? [];
				const row = (cells: string[], cell: string, index: number) =>
					h("tr", { key: index }, ...cells.map((value, at) => h(cell, { key: at }, value)));
				const body = h(
					"tbody",
					null,
					...(attrs.header ? rest : [first, ...rest]).map((cells, index) => row(cells, "td", index)),
				);
				return attrs.header
					? h("table", { key }, h("thead", null, row(first, "th", 0)), body)
					: h("table", { key }, body);
			}
			case "image": {
				const image = h("img", { src: media(attrs.media), alt: text(attrs.alt) ?? "", width: attrs.width });
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
	return doc.blocks.map(draw).filter((node) => node !== null);
}
