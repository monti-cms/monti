/**
 * The MDX plugin's server half (`@monti-cms/mdx`): what `monti.config.ts` imports. A body is always the JSON document; this reads `.md` and
 * `.mdx` into it on import and writes it back as MDX (doc 03, principle 1). Its half in the browser is `@monti-cms/mdx/admin`.
 */
import { type Block, definePlugin, type Monti, type Plugin, says } from "@monti-cms/core";
import { KEPT } from "./kept";
import { type MdxLanguage, mdxWords } from "./messages";
import { type FencedBlocks, type KnownBlocks, type KnownMarks, readMarkdown } from "./read";

export { KEPT, KEPT_HTML } from "./kept";
export {
	type FencedBlocks,
	fenceInfo,
	type KnownBlocks,
	type KnownMarks,
	type ReadFile,
	type ReadOptions,
	readMarkdown,
} from "./read";
export { toMdx, type WriteOptions } from "./write";

export type MdxOptions = {
	/** The language of the to-do an unknown component leaves on its entry: Korean unless said otherwise, as the admin is. */
	language?: MdxLanguage;
};

/** The component a kept-as-written block names: `<Tweet id="1" />` is `Tweet`, `:::chart` is `chart`. */
const nameOf = (text: string) =>
	/^<([A-Za-z][\w.]*)/.exec(text.trim())?.[1] ?? /^:{2,}([\w-]+)/.exec(text.trim())?.[1] ?? null;

/**
 * The MDX plugin (doc 14): the import reads `.md` and `.mdx` files with it, and a site without it does not read them.
 *
 * ```ts
 * // monti.config.ts
 * plugins: [mdx()]
 * // app/admin/page.tsx
 * <AdminPage plugins={[mdxAdmin]} />
 * ```
 */
export function mdx(options: MdxOptions = {}): Plugin {
	const words = mdxWords[options.language ?? "ko"];
	// The site's own blocks, known once the plugin is built into a site: a `:::name` directive that names one becomes that block.
	let known: KnownBlocks = () => null;
	// Its blocks written as fenced code (```` ```math ````, doc 18) and its own marks (`:color[words]{…}`).
	let fenced: FencedBlocks = () => null;
	let marks: KnownMarks = () => false;
	const CORE_ONLY = new Set(["listItem"]);
	const CORE_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "sup", "sub"]);
	return definePlugin({
		name: "mdx",
		label: "MDX",
		attach(monti: Monti) {
			known = (type) => (CORE_ONLY.has(type) ? null : (monti.site.kit.blocks.get(type)?.holds ?? null));
			fenced = (language) => {
				const block = [...monti.site.kit.blocks.values()].find((each) => each.fence?.language === language);
				return block?.fence ? { type: block.type, attr: block.fence.attr } : null;
			};
			marks = (name) => !CORE_MARKS.has(name) && monti.site.kit.marks.has(name);
		},
		importers: [
			{
				id: "mdx",
				label: "Markdown · MDX",
				extensions: [".md", ".mdx"],
				read: (file) =>
					readMarkdown(file.text, { mdx: file.name.toLowerCase().endsWith(".mdx"), known, fenced, marks }),
			},
		],
		// What was kept as written is not drawn as the component it was: its entry says so until someone looks at it.
		publishChecks: [
			(entry) => {
				const tasks: {
					code: string;
					field: string;
					block: string;
					blocking: boolean;
					message: ReturnType<typeof says>;
				}[] = [];
				const visit = (blocks: Block[]) => {
					for (const block of blocks) {
						if (block.type === "codeBlock" && block.attrs?.language === KEPT) {
							const text = (block.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
							tasks.push({
								code: "mdx.unknown",
								field: "doc",
								block: block.id,
								blocking: false,
								message: says(words.unknown(nameOf(text) ?? "")),
							});
						}
						if (block.children) visit(block.children);
					}
				};
				visit(((entry.doc as { blocks?: Block[] } | null)?.blocks ?? []) as Block[]);
				return tasks;
			},
		],
	});
}
