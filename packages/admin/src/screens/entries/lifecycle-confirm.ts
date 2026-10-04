import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { ConfirmRequest } from "../shared/confirm-dialog";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { t } from "./translate";

/** 편집 화면의 상태 전환(§5.3). */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

/** 묻고 나서 하는 전환. 공개 글을 내리는 보관과 휴지통 이동만 묻는다. 보관 해제·복원은 바로 한다. */
export type ConfirmedLifecycleAction = Extract<LifecycleAction, "archive" | "trash">;

/** 전환의 이름. 버튼·"먼저 저장하세요" 안내가 같은 말을 쓴다. */
export const LIFECYCLE_LABEL: Record<LifecycleAction, string> = {
	archive: t("lifecycle.archive"),
	unarchive: t("lifecycle.unarchive"),
	trash: t("lifecycle.trash"),
	restore: t("lifecycle.restore"),
};

/** 전환이 끝난 뒤 알릴 문구. */
export const LIFECYCLE_SUCCESS: Record<LifecycleAction, string> = {
	archive: t("lifecycle.success.archive"),
	unarchive: t("lifecycle.success.unarchive"),
	trash: t("lifecycle.success.trash"),
	restore: t("lifecycle.success.restore"),
};

/** 전환에 실패했을 때 알릴 문구. */
export const LIFECYCLE_FAILED: Record<LifecycleAction, string> = {
	archive: t("lifecycle.failed.archive"),
	unarchive: t("lifecycle.failed.unarchive"),
	trash: t("lifecycle.failed.trash"),
	restore: t("lifecycle.failed.restore"),
};

/**
 * 공개 글을 내리는 전환의 확인 문구. 공개본에서 이 글을 쓰는 곳이 있으면 함께 알리고(§6.1),
 * 원문을 옮기면 같은 묶음의 번역본도 함께 옮겨진다고 알린다(v2 B4).
 */
export function lifecycleConfirm(
	action: ConfirmedLifecycleAction,
	entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null,
	incomingReferences: readonly Pick<IncomingReferenceItem, "state">[],
): Omit<ConfirmRequest, "onConfirm"> {
	const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
	const usageNote = publishedUsers > 0 ? t("lifecycle.usage", { count: publishedUsers }) : "";
	const isTranslation = entry !== null && isTranslationEntry(entry);
	const otherLocales =
		entry && !isTranslation
			? (entry.translations ?? [])
					.filter((member) => member.id !== entry.id && member.status !== "trashed")
					.map((member) => member.locale.toUpperCase())
			: [];
	const hasGroup = otherLocales.length > 0;

	switch (action) {
		case "archive":
			return {
				title: LIFECYCLE_LABEL.archive,
				description: `${t("lifecycle.archive.ask", { translation: isTranslation ? 1 : 0 })}${usageNote}${hasGroup ? t("lifecycle.archive.group") : ""}`,
				confirmLabel: LIFECYCLE_LABEL.archive,
			};
		case "trash":
			return {
				title: LIFECYCLE_LABEL.trash,
				description: `${t("lifecycle.trash.ask", { translation: isTranslation ? 1 : 0 })}${usageNote}${hasGroup ? t("lifecycle.trash.group", { locales: otherLocales.join("·") }) : ""}`,
				confirmLabel: LIFECYCLE_LABEL.trash,
				destructive: true,
			};
	}
}
