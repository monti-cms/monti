import type { CmsNode } from "@monti-cms/core/mdx";
import { ADDED_BLOCK_CONVERTERS } from "../blocks/added";
import { codeBlockConverter } from "./code-block";
import { mathConverter } from "./fence-preview";
import { fileConverter } from "./file";
import { footnoteDefinitionConverter } from "./footnote";
import { imageConverter } from "./image";
import { tableConverter } from "./table";
import type { BlockConverter } from "./types";

export type { BlockConverter, ConverterContext } from "./types";

/**
 * Block converter registry. A block with an edit UI adds one more converter line here.
 * If two converters have the same `cmsTypes` or `tiptapTypes`, the registry test fails.
 * (However, detailed branch converters with `matches` may share the same cmsType.)
 */
export const BLOCK_CONVERTERS: readonly BlockConverter[] = [
	imageConverter,
	fileConverter,
	footnoteDefinitionConverter,
	mathConverter,
	codeBlockConverter,
	tableConverter,
	// Blocks added by block extensions and site settings (built from definitions). Code fence blocks are picked by language (`matches`).
	...ADDED_BLOCK_CONVERTERS,
];

const CMS_CONVERTERS_BY_TYPE = new Map<string, BlockConverter[]>();
const TIPTAP_CONVERTERS_BY_TYPE = new Map<string, BlockConverter>();

for (const converter of BLOCK_CONVERTERS) {
	for (const type of converter.cmsTypes) {
		const list = CMS_CONVERTERS_BY_TYPE.get(type) ?? [];
		list.push(converter);
		CMS_CONVERTERS_BY_TYPE.set(type, list);
	}
	for (const type of converter.tiptapTypes) {
		TIPTAP_CONVERTERS_BY_TYPE.set(type, converter);
	}
}

export const converterForCms = (type: string, node?: CmsNode): BlockConverter | undefined => {
	const candidates = CMS_CONVERTERS_BY_TYPE.get(type);
	if (!candidates || candidates.length === 0) return undefined;
	if (node) {
		const matched = candidates.find((c) => c.matches?.(node));
		if (matched) return matched;
	}
	return candidates.find((c) => !c.matches);
};

export const converterForTiptap = (type: string): BlockConverter | undefined => TIPTAP_CONVERTERS_BY_TYPE.get(type);
