import { createTranslator } from "@monti-cms/core/client";
import { toast } from "sonner";
import { mediaMessages } from "./messages";

const t = createTranslator(mediaMessages);

/** 미디어 목록 API의 한 항목. */
export interface MediaItem {
	id: string;
	status: "ready" | "deleting" | "pending" | "failed";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	publicUrl: string | null;
	original: { mimeType: string | null; byteSize: number | null; width: number | null; height: number | null } | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: string;
	referencesCount: number;
	references: { entryId: string; title: string | null; collection: string; state: "working" | "published" }[];
}

/** 미디어를 쓰는 글 하나. 고치는 중인 글(초안)과 공개된 글에서 따로 세던 것을 글마다 하나로 묶는다. */
export interface MediaUsage {
	entryId: string;
	title: string | null;
	collection: string;
	/** 한쪽에서만 쓰일 때의 안내. 둘 다에서 쓰이면 없다. */
	note?: "beforePublish" | "publishedOnly";
}

/**
 * 사용처를 글마다 하나로 묶는다. 발행한 글은 초안과 공개본이 같은 이미지를 함께 써서 두 번 잡히는데, 사람에게는 한 글이다.
 * 초안에만 있으면(새로 넣고 아직 발행 전) "발행 전", 공개본에만 있으면(초안에서는 뺐지만 공개 글에는 남음) "공개 글에만"이라고 붙인다.
 */
export function mediaUsages(media: Pick<MediaItem, "references">): MediaUsage[] {
	const byEntry = new Map<string, MediaUsage & { states: Set<"working" | "published"> }>();
	for (const reference of media.references) {
		const current = byEntry.get(reference.entryId);
		if (current) {
			current.states.add(reference.state);
			// 공개본 쪽 이름이 비어 있으면 초안 쪽 이름을 쓴다.
			current.title ||= reference.title;
		} else {
			byEntry.set(reference.entryId, {
				entryId: reference.entryId,
				title: reference.title,
				collection: reference.collection,
				states: new Set([reference.state]),
			});
		}
	}
	return [...byEntry.values()].map(({ states, ...usage }) =>
		states.size === 2 ? usage : { ...usage, note: states.has("working") ? "beforePublish" : "publishedOnly" },
	);
}

/** 사용처 수. 글마다 하나로 센다(템플릿 등 글이 아닌 사용처만 있으면 서버가 센 수). */
export const usageCount = (media: MediaItem) => mediaUsages(media).length || media.referencesCount;

/** 목록·타일에 붙는 사용 여부. */
export const usageLabel = (media: MediaItem) =>
	media.status === "deleting"
		? t("usage.deleting")
		: media.referencesCount > 0
			? t("usage.count", { count: usageCount(media) })
			: t("usage.none");

/** 사용처 안내(`note`)의 글자. */
export const usageNoteLabel = (note: NonNullable<MediaUsage["note"]>) =>
	t(note === "beforePublish" ? "usage.note.beforePublish" : "usage.note.publishedOnly");

export async function copyText(text: string, success: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(success);
	} catch {
		toast.error(t("common.copyFailed"));
	}
}

/** 새 이름에 원래 파일의 확장자를 붙인다(추천 이름은 확장자 없이 온다). 이미 같은 확장자면 그대로 둔다. */
export function withExtension(name: string, original: string): string {
	const extension = /\.[A-Za-z0-9]{1,8}$/.exec(original)?.[0]?.toLowerCase() ?? "";
	return extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name;
}
