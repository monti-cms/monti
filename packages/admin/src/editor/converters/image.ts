import type { CmsJsonValue } from "@monti-cms/core/mdx";
import { isValidCrop, isValidRotate } from "@monti-cms/core/mdx";
import type { BlockConverter } from "./types";

const IMAGE_ATTRS = [
	"mediaId",
	"src",
	"alt",
	"width",
	"align",
	"caption",
	"decorative",
	"crop",
	"rotate",
	"title",
] as const;

/** `decorative` is carried only when true — false or absent is not saved. */
const isDecorative = (value: unknown): boolean => value === true;

export const imageConverter: BlockConverter = {
	name: "image",
	cmsTypes: ["image"],
	tiptapTypes: ["image"],
	isMappable: () => true,
	toTiptap(node) {
		const source = node.attrs ?? {};
		const attrs: Record<string, CmsJsonValue> = {};
		for (const key of IMAGE_ATTRS) {
			const value = source[key];
			if (value === undefined || value === null) continue;
			if (key === "decorative" && !isDecorative(value)) continue;
			if (key === "rotate" && (value === "0" || value === 0 || value === "")) continue;
			if (key === "crop" && (value === "" || value === "0,0,100,100")) continue;
			attrs[key] = value;
		}
		return { type: "image", attrs };
	},
	toCms(node) {
		const source = node.attrs ?? {};
		const attrs: Record<string, CmsJsonValue> = {};
		for (const key of IMAGE_ATTRS) {
			const value = (source as Record<string, unknown>)[key];
			if (value == null) continue;
			if (key === "decorative" && !isDecorative(value)) continue;
			// Tiptap defaults are not saved — if absent, it must round-trip to a Markdown image.
			// `align="center"` equals the public default, so it is omitted. `width` is not omitted —
			// an explicit `100%` and unspecified render differently on the public side (inline width present or not).
			if (key === "align" && value === "center") continue;
			if ((key === "caption" || key === "title") && value === "") continue;
			// Rotation 0/none and full crop are defaults, so they are not saved.
			if (key === "rotate" && (value === "0" || value === 0 || value === "" || !isValidRotate(value))) continue;
			if (key === "crop" && (value === "" || value === "0,0,100,100" || !isValidCrop(value))) continue;
			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				attrs[key] = value;
			}
		}
		return [{ type: "image", attrs }];
	},
};
