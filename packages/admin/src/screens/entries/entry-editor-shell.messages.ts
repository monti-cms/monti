import { defineMessages } from "@monti-cms/core";
import { josa } from "@monti-cms/core/site";
import { enNoun, koNoun, koObject } from "../shared/noun.messages";

/** The action the user was attempting, used in the "blocked" notice. English: "before ○○ing"; Korean: "○○하세요". */
const PURPOSE_KO: Record<string, string> = {
	publish: "발행",
	duplicate: "복제",
	archive: "보관",
	unarchive: "보관 해제",
	trash: "휴지통으로 이동",
	restore: "복원",
};
const PURPOSE_EN: Record<string, string> = {
	publish: "publishing",
	duplicate: "duplicating",
	archive: "archiving",
	unarchive: "unarchiving",
	trash: "moving to the trash",
	restore: "restoring",
};

/** Messages for the editor shell (header, buttons, notices). */
export const entryEditorShellMessages = defineMessages("cms-admin.entries.shell", {
	en: {
		saveFirst: ({ purpose }) => `Save your changes before ${PURPOSE_EN[String(purpose)]}.`,
		conflictFirst: ({ purpose }) => `Resolve the edit conflict before ${PURPOSE_EN[String(purpose)]}.`,
		notSaved: ({ purpose, reason }) =>
			`Your changes weren't saved to the server, so ${PURPOSE_EN[String(purpose)]} was cancelled. ${reason}`,
		backupUnavailable: " · No browser backup",
		usagesFailed: "Couldn't load usages.",
		checkSaveStatus: "Check the save status.",
		previewNotOpened: "Couldn't save, so the preview wasn't opened.",
		fillDone: ({ label }) => `Created ${label} from the body. You can edit it in the properties panel.`,
		sourceUnreviewed: "There are source changes you haven't reviewed.",
		publishedWithWarnings: ({ count }) =>
			`Published. ${count} ${Number(count) === 1 ? "warning" : "warnings"} to review`,
		go: "Go",
		published: "Published.",
		publishBlocked: "Can't publish. See what to fix in the status bar.",
		permanentDeleteAsk: (vars) =>
			`Permanently delete this ${enNoun(vars)}? This can't be undone. Addresses that were ever public are only recorded so other entries can't reuse them.`,
		loadingDocument: "Loading document…",
		backToList: "Back to list",
		loadNotFound: "It can't be found. It may have been deleted or its address changed. Find it again in the list.",
		title: "Title",
		preview: "Preview",
		"preview.no-preview-path": "Preview isn't set up. Set previewPath in monti.schema.ts (site section).",
		"preview.no-public-page":
			"This collection has no public page, so there is nothing to preview. Give it a path in monti.schema.ts.",
		"preview.no-slug": "Save first so the entry has an address to preview.",
		restoring: "Restoring…",
		unarchiving: "Unarchiving…",
		publishing: "Publishing…",
		publishOptions: "Publish options",
		republish: "Republish with today's date",
		properties: "Properties",
		more: "More",
		toggleTheme: "Toggle theme",
		trash: "Trash",
		trashNotice: (vars) => `This ${enNoun(vars)} is in the trash`,
		trashNoticeMeta: ({ days }) =>
			`Restoring brings it back as a draft · ${days} ${Number(days) === 1 ? "day" : "days"} left`,
		visualUnavailable:
			"Part of the body can't be parsed, so you can only edit in source mode. You can save, but publishing is blocked —",
		sourceChanged: "The source changed",
		compare: "Compare",
		confirm: "Confirm",
	},
	ko: {
		saveFirst: ({ purpose }) => `변경사항을 먼저 저장한 후 ${PURPOSE_KO[String(purpose)]}하세요.`,
		conflictFirst: ({ purpose }) => `편집 충돌을 해결한 후 ${PURPOSE_KO[String(purpose)]}하세요.`,
		notSaved: ({ purpose, reason }) =>
			`변경사항이 서버에 저장되지 않아 ${PURPOSE_KO[String(purpose)]}하지 않았어요. ${reason}`,
		backupUnavailable: " · 브라우저 복구 불가",
		usagesFailed: "사용처를 불러오지 못했어요.",
		checkSaveStatus: "저장 상태를 확인하세요.",
		previewNotOpened: "저장하지 못해 미리보기를 열지 않았어요.",
		fillDone: ({ label }) => `본문에서 ${josa(String(label), "을", "를")} 만들었어요. 속성 패널에서 고칠 수 있어요.`,
		sourceUnreviewed: "확인하지 않은 원문 변경이 있어요.",
		publishedWithWarnings: "발행되었어요. 확인할 경고 {count}건",
		go: "이동",
		published: "발행되었어요.",
		publishBlocked: "발행할 수 없어요. 아래 상태 표시줄에서 고칠 곳을 확인하세요.",
		permanentDeleteAsk: (vars) =>
			`이 ${koObject(vars)} 영구 삭제할까요? 되돌릴 수 없어요. 공개된 적 있는 주소는 다른 항목이 다시 쓸 수 없도록 기록만 남아요.`,
		loadingDocument: "문서를 불러오는 중…",
		backToList: "목록으로",
		loadNotFound: "찾을 수 없어요. 삭제됐거나 주소가 바뀌었을 수 있어요. 목록에서 다시 찾아 주세요.",
		title: "제목",
		preview: "미리보기",
		"preview.no-preview-path": "미리보기가 설정되지 않았어요. monti.schema.ts의 site에 previewPath를 지정하세요.",
		"preview.no-public-page": "이 컬렉션은 공개 페이지가 없어 미리볼 수 없어요. monti.schema.ts에서 path를 지정하세요.",
		"preview.no-slug": "먼저 저장해 항목에 주소가 생겨야 미리볼 수 있어요.",
		restoring: "복원 중…",
		unarchiving: "보관 해제 중…",
		publishing: "발행 중…",
		publishOptions: "발행 방식",
		republish: "오늘 날짜로 다시 발행",
		properties: "속성",
		more: "더보기",
		toggleTheme: "테마 전환",
		trash: "휴지통",
		trashNotice: (vars) => `휴지통에 있는 ${josa(koNoun(vars), "이에요", "예요")}`,
		trashNoticeMeta: ({ days }) => `복원하면 초안으로 돌아와요 · ${days}일 남음`,
		visualUnavailable: "해석할 수 없는 본문이 있어 원문 모드로만 편집해요. 저장은 되지만 발행은 막혀요 —",
		sourceChanged: "원문이 바뀌었어요",
		compare: "비교",
		confirm: "확인",
	},
});
