import { defineMessages } from "@monti-cms/core";

const one = (count: unknown) => Number(count) === 1;

/** Text of the backup restore: the restore sheet the Data page opens for a full backup, with its preview and its result. */
export const restoreMessages = defineMessages("cms-admin.restore", {
	en: {
		title: "Restore as it was",
		"summary.entries": ({ count }) => `${count} ${one(count) ? "entry" : "entries"}`,
		"summary.draft": ({ count }) => `${count} ${one(count) ? "draft" : "drafts"}`,
		"summary.published": ({ count }) => `${count} published`,
		"summary.archived": ({ count }) => `${count} archived`,
		"summary.trashed": ({ count }) => `${count} in the trash`,
		"summary.translations": ({ count }) =>
			`${count} of the entries ${one(count) ? "is a translation" : "are translations"}`,
		"summary.folders": ({ count }) => `${count} ${one(count) ? "folder" : "folders"}`,
		"summary.media": ({ count }) => `${count} media ${one(count) ? "record" : "records"}`,
		"summary.addresses": ({ count, aliases }) =>
			`${count} ${one(count) ? "address" : "addresses"}, ${aliases} of them old ${one(aliases) ? "address that keeps" : "addresses that keep"} redirecting`,
		"summary.templates": ({ added, skipped }) =>
			`${added} ${one(added) ? "template" : "templates"} added, ${skipped} skipped`,
		"templates.title": "Templates not added",
		"problems.title": "Problems",
		"problems.hint": "Nothing is restored while any problem is left. A restore is all or nothing.",
		"problems.more": ({ count }) => `and ${count} more ${one(count) ? "problem" : "problems"}`,
		"problems.archive": "The backup",
		"warnings.title": "Worth knowing",
		"warnings.more": ({ count }) => `and ${count} more`,
		"notRestored.title": "Not restored",
		"notRestored.hint":
			"A restore brings back the content only. These are left as they are, and each one is listed here.",
		"action.restore": "Restore",
		"action.restoring": "Restoring…",
		"action.view": "View list",
		"result.title": "Backup restored",
		"result.summary": ({ count }) =>
			`${count} ${one(count) ? "entry was" : "entries were"} restored exactly as they were.`,
		"toast.done": ({ count }) => `Restored ${count} ${one(count) ? "entry" : "entries"}.`,
		"error.run": "The backup could not be restored. Nothing was written.",
	},
	ko: {
		title: "있던 그대로 복원",
		"summary.entries": ({ count }) => `글 ${count}개`,
		"summary.draft": ({ count }) => `초안 ${count}개`,
		"summary.published": ({ count }) => `발행 ${count}개`,
		"summary.archived": ({ count }) => `보관 ${count}개`,
		"summary.trashed": ({ count }) => `휴지통 ${count}개`,
		"summary.translations": ({ count }) => `이 중 ${count}개는 번역이에요`,
		"summary.folders": ({ count }) => `폴더 ${count}개`,
		"summary.media": ({ count }) => `미디어 정보 ${count}개`,
		"summary.addresses": ({ count, aliases }) => `주소 ${count}개, 이 중 계속 이어지는 이전 주소 ${aliases}개`,
		"summary.templates": ({ added, skipped }) => `템플릿 ${added}개 추가, ${skipped}개 건너뜀`,
		"templates.title": "추가하지 않는 템플릿",
		"problems.title": "문제",
		"problems.hint": "문제가 하나라도 남아 있으면 아무것도 복원하지 않아요. 복원은 전부 하거나 전혀 하지 않아요.",
		"problems.more": ({ count }) => `외 문제 ${count}개`,
		"problems.archive": "백업 파일",
		"warnings.title": "알아 두세요",
		"warnings.more": ({ count }) => `외 ${count}개`,
		"notRestored.title": "복원하지 않는 것",
		"notRestored.hint": "복원은 내용만 되돌려요. 아래는 그대로 두며, 하나씩 알려 드려요.",
		"action.restore": "복원",
		"action.restoring": "복원하는 중…",
		"action.view": "목록에서 보기",
		"result.title": "백업을 복원했어요",
		"result.summary": ({ count }) => `글 ${count}개를 있던 그대로 복원했어요.`,
		"toast.done": ({ count }) => `글 ${count}개를 복원했어요.`,
		"error.run": "백업을 복원하지 못했어요. 아무것도 쓰지 않았어요.",
	},
});
