import { perSite, type Site } from "@monti-cms/core/client";
import type { CmsNode } from "@monti-cms/core/document";
import { addedBlockConvertersOf } from "../blocks/added";
import { codeBlockConverter } from "./code-block";
import { mathConverter } from "./fence-preview";
import { fileConverter } from "./file";
import { footnoteDefinitionConverter } from "./footnote";
import { imageConverter } from "./image";
import { tableConverter } from "./table";
import type { BlockConverter } from "./types";

export type { BlockConverter, ConverterContext } from "./types";

/**
 * Block converter registry of a site. A block with an edit UI adds one more converter line here.
 * If two converters have the same `cmsTypes` or `tiptapTypes`, the registry test fails.
 * (However, detailed branch converters with `matches` may share the same cmsType.)
 */
export const blockConvertersOf = (site: Pick<Site, "ADDED_BLOCKS">): readonly BlockConverter[] =>
	registryOf(site).converters;

const registryOf = perSite((site: Pick<Site, "ADDED_BLOCKS">) => {
	const converters: readonly BlockConverter[] = [
		imageConverter,
		fileConverter,
		footnoteDefinitionConverter,
		mathConverter,
		codeBlockConverter,
		tableConverter,
		// Blocks added by block extensions and site settings (built from definitions). Code fence blocks are picked by language (`matches`).
		...addedBlockConvertersOf(site),
	];
	const byCmsType = new Map<string, BlockConverter[]>();
	const byTiptapType = new Map<string, BlockConverter>();
	for (const converter of converters) {
		for (const type of converter.cmsTypes) {
			const list = byCmsType.get(type) ?? [];
			list.push(converter);
			byCmsType.set(type, list);
		}
		for (const type of converter.tiptapTypes) {
			byTiptapType.set(type, converter);
		}
	}
	return { converters, byCmsType, byTiptapType };
});

export const converterForCms = (
	site: Pick<Site, "ADDED_BLOCKS">,
	type: string,
	node?: CmsNode,
): BlockConverter | undefined => {
	const candidates = registryOf(site).byCmsType.get(type);
	if (!candidates || candidates.length === 0) return undefined;
	if (node) {
		const matched = candidates.find((c) => c.matches?.(node));
		if (matched) return matched;
	}
	return candidates.find((c) => !c.matches);
};

export const converterForTiptap = (site: Pick<Site, "ADDED_BLOCKS">, type: string): BlockConverter | undefined =>
	registryOf(site).byTiptapType.get(type);
