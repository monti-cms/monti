import { createTranslator } from "@monti-cms/core/client";
import { sharedMessages } from "./messages";

const t = createTranslator(sharedMessages);

export type EntryStatus = "draft" | "published" | "archived" | "trashed";

export const STATUS_LABELS: Record<EntryStatus, string> = {
	draft: t("status.draft"),
	published: t("status.published"),
	archived: t("status.archived"),
	trashed: t("status.trashed"),
};

/**
 * 목록·편집 화면의 상태 문구(§5.3). 색상만으로 상태를 전달하지 않도록 항상 글자로 쓴다(§3.2).
 * 공개본과 다른 초안은 `발행됨 · 수정 중`이다.
 */
export function describeEntryStatus(entry: { status: EntryStatus; hasUnpublishedChanges?: boolean }): string {
	let label = STATUS_LABELS[entry.status] ?? entry.status;
	if (entry.status === "published" && entry.hasUnpublishedChanges) label += ` · ${t("status.editing")}`;
	return label;
}
