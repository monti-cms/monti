import { BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { type StoredDocument, UNPARSED_NODE } from "../../doc/stored-document";
import type { CmsJsonValue, CmsNode } from "../../doc/types";
import { createTranslator } from "../../i18n";
import { translationMessages } from "./messages";

/**
 * Structure check of translation results. Checks that the source and the translation have the same "skeleton without text".
 *
 * - Must be the same: kinds and order of block and inline elements, link addresses, image addresses, code/math contents, code languages,
 *   block names and attributes humans do not read, inline code text.
 * - May differ: text, values of human-readable attributes, where bold/links fall inside a sentence.
 *
 * Human-readable attributes are decided by the block definition: translatable attributes (`translatable`) and attributes that point to such an attribute's value
 * (`childValue`, e.g. initially open tab → tab name). Blocks added by the site follow the same rules.
 */

/** Human-readable attributes of elements without a block definition (link title `[text](address "title")`). */
const MARKDOWN_READABLE: Readonly<Record<string, readonly string[]>> = { link: ["title"] };

/** Human-readable attribute names of one block. */
export function readableAttributes(
	block: BlockDefinition,
	blockByName: ReadonlyMap<string, BlockDefinition>,
): Set<string> {
	const childTranslatable = new Set(
		(block.children?.blocks ?? []).flatMap((name) =>
			Object.entries(blockByName.get(name)?.attributes ?? {}).flatMap(([attribute, definition]) =>
				definition.translatable ? [attribute] : [],
			),
		),
	);
	return new Set(
		Object.entries(block.attributes).flatMap(([name, attribute]) =>
			attribute.translatable || (attribute.childValue !== undefined && childTranslatable.has(attribute.childValue))
				? [name]
				: [],
		),
	);
}

/**
 * Node/mark kind → human-readable attributes. The kind is the block name as stored (`callout`, `tooltip`, `image`) or `link` for a link mark.
 */
export function readableAttributesByType(blocks: readonly BlockDefinition[]): Map<string, ReadonlySet<string>> {
	const byName = new Map(blocks.map((block) => [block.name, block]));
	const map = new Map<string, ReadonlySet<string>>();
	for (const block of blocks) {
		const readable = readableAttributes(block, byName);
		if (readable.size === 0) continue;
		map.set(block.name, readable);
	}
	for (const [type, names] of Object.entries(MARKDOWN_READABLE)) map.set(type, new Set(names));
	return map;
}

let readableByType: Map<string, ReadonlySet<string>> | undefined;
const NONE: ReadonlySet<string> = new Set();
const readableOf = (type: string): ReadonlySet<string> => {
	readableByType ??= readableAttributesByType(BLOCKS);
	return readableByType.get(type) ?? NONE;
};

type Skeleton = {
	type: string;
	attrs: Record<string, CmsJsonValue>;
	/** Formatting (kind, address) applied to text directly under this node. Collected without overlap and sorted. */
	marks: string[];
	/** Inline code text directly under this node (not translated). */
	codes: string[];
	children: Skeleton[];
};

const withoutReadable = (
	type: string,
	attrs: Record<string, CmsJsonValue> | undefined,
): Record<string, CmsJsonValue> => {
	const readable = readableOf(type);
	const kept: Record<string, CmsJsonValue> = {};
	for (const [key, value] of Object.entries(attrs ?? {})) {
		if (!readable.has(key)) kept[key] = value;
	}
	return kept;
};

function skeletonOf(node: CmsNode): Skeleton {
	const marks = new Set<string>();
	const codes: string[] = [];
	const children: Skeleton[] = [];
	for (const child of node.content ?? []) {
		if (child.type !== "text") {
			children.push(skeletonOf(child));
			continue;
		}
		for (const mark of child.marks ?? []) {
			if (mark.type === "code") codes.push(child.text ?? "");
			else marks.add(JSON.stringify([mark.type, withoutReadable(mark.type, mark.attrs)]));
		}
	}
	return {
		type: node.type,
		attrs: withoutReadable(node.type, node.attrs),
		marks: [...marks].sort(),
		codes: codes.sort(),
		children,
	};
}

/** Failure reason codes of the structure check. The reason message is `reason`. */
export type StructureFailCode = "mdx_error" | "source_unreadable" | "structure_changed";

export type StructureCheck =
	| { ok: true }
	| {
			ok: false;
			code: StructureFailCode /** Reason in the site's display language (`cms.translation` dictionary). */;
			reason: string;
	  };

const tTranslation = createTranslator(translationMessages);

/** The failure of a translated body that is not a document (`message`: why it could not be read, in the site's display language). */
export const unreadableFailure = (message: string | undefined): StructureCheck => ({
	ok: false,
	code: "mdx_error",
	reason: tTranslation("mdx_error", { message: message ?? tTranslation("unreadable") }),
});

const isUnparsed = (doc: StoredDocument) => doc.content.some((node) => node.type === UNPARSED_NODE);

/** Whether the translated document has the same skeleton as the source document. Failure if either is not a document (an `unparsed` body). */
export function compareStructure(source: StoredDocument, translated: StoredDocument): StructureCheck {
	if (isUnparsed(translated)) return unreadableFailure(undefined);
	if (isUnparsed(source)) return { ok: false, code: "source_unreadable", reason: tTranslation("source_unreadable") };
	const a = skeletonOf({ type: "doc", content: [...source.content] });
	const b = skeletonOf({ type: "doc", content: [...translated.content] });
	return JSON.stringify(a) === JSON.stringify(b)
		? { ok: true }
		: { ok: false, code: "structure_changed", reason: tTranslation("structure_changed") };
}
