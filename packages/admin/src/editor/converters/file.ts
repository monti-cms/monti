import type { CmsJsonValue } from "@monti-cms/core/mdx";
import type { BlockConverter } from "./types";

/** 첨부 파일 카드(`::file{mediaId label}`, v3). 빈 `label`은 저장하지 않는다. */
export const fileConverter: BlockConverter = {
	name: "file",
	cmsTypes: ["File"],
	tiptapTypes: ["cmsFile"],
	isMappable: (node) => typeof node.attrs?.mediaId === "string" && node.attrs.mediaId !== "",
	toTiptap(node) {
		const label = node.attrs?.label;
		return {
			type: "cmsFile",
			attrs: { mediaId: node.attrs?.mediaId ?? null, label: typeof label === "string" && label ? label : null },
		};
	},
	toCms(node) {
		const record: Record<string, CmsJsonValue> = {};
		if (typeof node.attrs?.mediaId === "string") record.mediaId = node.attrs.mediaId;
		if (typeof node.attrs?.label === "string" && node.attrs.label.trim()) record.label = node.attrs.label;
		const attributes = Object.entries(record).map(([name, value]) => ({ name, value }));
		return [{ type: "File", attrs: { ...record, name: "File", attributes } }];
	},
};
