import { perSite } from "@monti-cms/core/client";
import { addedBlockConvertersOf } from "../blocks/added/index.js";
import { codeBlockConverter } from "./code-block.js";
import { mathConverter } from "./fence-preview.js";
import { fileConverter } from "./file.js";
import { footnoteDefinitionConverter } from "./footnote.js";
import { imageConverter } from "./image.js";
import { tableConverter } from "./table.js";
/**
 * Block converter registry of a site. A block with an edit UI adds one more converter line here.
 * If two converters have the same `cmsTypes` or `tiptapTypes`, the registry test fails.
 * (However, detailed branch converters with `matches` may share the same cmsType.)
 */
export const blockConvertersOf = (site) => registryOf(site).converters;
const registryOf = perSite((site) => {
    const converters = [
        imageConverter,
        fileConverter,
        footnoteDefinitionConverter,
        mathConverter,
        codeBlockConverter,
        tableConverter,
        // Blocks added by block extensions and site settings (built from definitions). Code fence blocks are picked by language (`matches`).
        ...addedBlockConvertersOf(site),
    ];
    const byCmsType = new Map();
    const byTiptapType = new Map();
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
export const converterForCms = (site, type, node) => {
    const candidates = registryOf(site).byCmsType.get(type);
    if (!candidates || candidates.length === 0)
        return undefined;
    if (node) {
        const matched = candidates.find((c) => c.matches?.(node));
        if (matched)
            return matched;
    }
    return candidates.find((c) => !c.matches);
};
export const converterForTiptap = (site, type) => registryOf(site).byTiptapType.get(type);
