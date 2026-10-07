import { resolveLabels } from "../i18n/active";
import type { BlockDefinition } from "./define";
import { addedBlocks, type BlockSources, resolveBlocks } from "./resolve";

/** The body blocks of one site. */
export type SiteBlocks = ReturnType<typeof createBlocks>;

/**
 * The blocks a site config uses: core blocks plus the blocks added by its plugins and its own `blocks`, and the tables built from them. The definitions are plain values:
 * the labels (getters in the modules that define them) are read once, in the language the caller has set (`createSite` does it for the admin language).
 */
export function createBlocks(sources: BlockSources | undefined) {
	/** Body blocks the site uses (core blocks plus blocks added by plugins and site config). Read by the storage syntax table, validation, the editor, and `/meta`. */
	const BLOCKS: readonly BlockDefinition[] = resolveLabels(resolveBlocks(sources));

	const ACTIVE = new Set(BLOCKS.map((block) => block.name));

	/** Whether this block is used (installed). */
	const isBlockActive = (name: string): boolean => ACTIVE.has(name);

	const addedNames = new Set(addedBlocks(sources).map(({ block }) => block.name));

	/** Added blocks (block extension plugins and the site config's `blocks`). The editor builds nodes from these definitions. */
	const ADDED_BLOCKS: readonly BlockDefinition[] = BLOCKS.filter((block) => addedNames.has(block.name));

	/** Added text marks (`syntax.kind: "text"`, `editor.view: "mark"`). Add order is the order overlapping marks are stored. */
	const ADDED_MARK_BLOCKS: readonly BlockDefinition[] = ADDED_BLOCKS.filter((block) => block.syntax.kind === "text");

	/**
	 * Mark sort order. The parser of a format, its writer and the editor conversion (`tiptap-content`) must use the same order so that
	 * round-trip document comparison does not break because of ordering. Added text decorations come after the translation note (outermost), in the order they were added.
	 */
	const MARK_ORDER: readonly string[] = [
		"untranslated",
		...ADDED_MARK_BLOCKS.map((block) => block.name),
		"underline",
		"superscript",
		"subscript",
		"link",
		"bold",
		"italic",
		"strike",
		"code",
	];

	const sortMarks = <T extends { type: string }>(marks: readonly T[]): T[] =>
		[...marks].sort((left, right) => MARK_ORDER.indexOf(left.type) - MARK_ORDER.indexOf(right.type));

	const BLOCK_BY_NAME: ReadonlyMap<string, BlockDefinition> = new Map(BLOCKS.map((block) => [block.name, block]));

	/** Public renderer name (JSX name) → block definition. */
	const BLOCK_BY_COMPONENT: ReadonlyMap<string, BlockDefinition> = new Map(
		BLOCKS.map((block) => [block.component, block]),
	);

	/** Directive-syntax blocks (`:::`, `::`, `:`). Code fences and math use Markdown syntax, so they are not in the directive table. */
	const directiveBlocks = (): BlockDefinition[] =>
		BLOCKS.filter(
			(block) => block.syntax.kind === "container" || block.syntax.kind === "leaf" || block.syntax.kind === "text",
		);

	/** Added code fence blocks. Fence language → block definition. */
	const FENCE_BLOCKS: ReadonlyMap<string, BlockDefinition> = new Map(
		ADDED_BLOCKS.flatMap((block) => (block.syntax.kind === "fence" ? [[block.syntax.lang, block] as const] : [])),
	);

	/** The added block for a code fence language. Case-insensitive. */
	const fenceBlockOf = (lang: unknown): BlockDefinition | undefined =>
		typeof lang === "string" ? FENCE_BLOCKS.get(lang.toLowerCase()) : undefined;

	/** Blocks with child block rules (name, count) and their children's renderer names. The storage check counts them. */
	const childRules = (): { block: BlockDefinition; childComponents: string[] }[] =>
		ADDED_BLOCKS.flatMap((block) => {
			const names = block.children?.blocks ?? [];
			if (names.length === 0) return [];
			const childComponents = names.flatMap((name) => BLOCK_BY_NAME.get(name)?.component ?? []);
			return [{ block, childComponents }];
		});

	return {
		BLOCKS,
		isBlockActive,
		ADDED_BLOCKS,
		ADDED_MARK_BLOCKS,
		MARK_ORDER,
		sortMarks,
		BLOCK_BY_NAME,
		BLOCK_BY_COMPONENT,
		directiveBlocks,
		FENCE_BLOCKS,
		fenceBlockOf,
		childRules,
	};
}
