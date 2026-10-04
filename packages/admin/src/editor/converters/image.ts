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

/** `decorative`는 참일 때만 싣는다 — 거짓·없음은 저장하지 않는다(§4.4). */
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
			// Tiptap 기본값은 저장하지 않는다 — 없으면 Markdown 이미지로 돌아가야 한다.
			// `align="center"`는 공개 기본값과 같아 생략한다(R3). `width`는 생략하지 않는다 —
			// 명시적 `100%`와 미지정은 공개 렌더가 다르다(인라인 width 유무, O2).
			if (key === "align" && value === "center") continue;
			if ((key === "caption" || key === "title") && value === "") continue;
			// 회전 0/없음·전체 자르기는 기본값이므로 저장하지 않는다(c-editor.md §1.1).
			if (key === "rotate" && (value === "0" || value === 0 || value === "" || !isValidRotate(value))) continue;
			if (key === "crop" && (value === "" || value === "0,0,100,100" || !isValidCrop(value))) continue;
			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				attrs[key] = value;
			}
		}
		return [{ type: "image", attrs }];
	},
};
