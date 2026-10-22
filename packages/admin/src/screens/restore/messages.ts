import { defineMessages } from "@monti-cms/core";

const one = (count: unknown) => Number(count) === 1;

/** Text of the backup restore: the Restore backup card on the Data page, with its preview, its confirmation and its result. */
export const restoreMessages = defineMessages("cms-admin.restore", {
	en: {
		title: "Restore backup",
		description:
			"Put a full backup back into an empty site exactly as it was: the same entries and ids, drafts and published versions, translations, folders, media records and old addresses.",
		"notEmpty.title": "Works only on an empty site",
		"notEmpty.description":
			"This site already has entries, folders or media records, so a backup can't be restored into it. To add entries from a backup, use Import entries.",
		"kinds.label": "What you can choose",
		"kinds.backup":
			"A full backup made on this page with Everything (drafts included) and no selection. A selection or a public export is not accepted.",
		"file.choose": "Choose a backup (.zip)",
		"file.change": "Choose another file",
		"file.tooLarge": ({ limit }) => `That file is larger than ${limit}.`,
		"preview.loading": "Checking the backup against this site…",
		"preview.failed": "The backup could not be read.",
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
		"action.cancel": "Start over",
		"confirm.title": "Restore this backup?",
		"confirm.description": ({ count }) =>
			`${count} ${one(count) ? "entry" : "entries"}, with their folders, media records and addresses, are written to this site in one step. Either all of it is written or none of it is. Afterwards the site is no longer empty, so a backup can't be restored into it again.`,
		"confirm.confirm": "Restore the backup",
		"danger.title": "Danger zone",
		"danger.description":
			"A restore writes the whole backup into the site in one step: entries with their ids, drafts and published versions, translations, folders, media records and old addresses. It only works while the site has no entries, folders or media records, so nothing that is here now is replaced. It can't be undone or run again.",
		"progress.running": ({ count }) => `Restoring ${count} ${one(count) ? "entry" : "entries"}…`,
		"progress.hint": "Everything is written in one step. Keep this page open.",
		"result.title": "Backup restored",
		"result.summary": ({ count }) =>
			`${count} ${one(count) ? "entry was" : "entries were"} restored exactly as they were.`,
		"result.open": "Open the entries list",
		"toast.done": ({ count }) => `Restored ${count} ${one(count) ? "entry" : "entries"}.`,
		"error.run": "The backup could not be restored. Nothing was written.",
	},
	ko: {
		title: "백업 복원",
		description:
			"전체 백업을 빈 사이트에 있던 그대로 되돌려요. 글과 id, 초안과 발행본, 번역, 폴더, 미디어 정보, 이전 주소가 모두 그대로 돌아와요.",
		"notEmpty.title": "빈 사이트에서만 복원할 수 있어요",
		"notEmpty.description":
			"이 사이트에는 이미 글, 폴더 또는 미디어 정보이 있어서 백업을 복원할 수 없어요. 백업에서 글을 더하려면 글 가져오기를 쓰세요.",
		"kinds.label": "고를 수 있는 파일",
		"kinds.backup":
			"이 페이지에서 만든 전체 백업(초안 포함, 선택 없음)이에요. 일부만 고른 파일이나 공개 내보내기는 받지 않아요.",
		"file.choose": "백업 고르기 (.zip)",
		"file.change": "다른 파일 고르기",
		"file.tooLarge": ({ limit }) => `파일이 ${limit}보다 커요.`,
		"preview.loading": "백업이 이 사이트와 맞는지 확인하는 중…",
		"preview.failed": "백업을 읽지 못했어요.",
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
		"action.cancel": "처음부터",
		"confirm.title": "이 백업을 복원할까요?",
		"confirm.description": ({ count }) =>
			`글 ${count}개와 폴더, 미디어 정보, 주소를 한 번에 이 사이트에 써요. 전부 쓰거나 전혀 쓰지 않아요. 복원하고 나면 사이트가 비어 있지 않으니 같은 백업을 다시 복원할 수 없어요.`,
		"confirm.confirm": "백업 복원하기",
		"danger.title": "위험 구역",
		"danger.description":
			"복원은 백업 전체를 한 번에 사이트에 써요. 글과 id, 초안과 발행본, 번역, 폴더, 미디어 정보, 이전 주소가 들어가요. 글, 폴더, 미디어 정보이 하나도 없을 때만 되므로 지금 있는 내용을 덮어쓰지는 않아요. 되돌리거나 다시 실행할 수 없어요.",
		"progress.running": ({ count }) => `글 ${count}개를 복원하는 중…`,
		"progress.hint": "모두 한 번에 써요. 이 페이지를 닫지 마세요.",
		"result.title": "백업을 복원했어요",
		"result.summary": ({ count }) => `글 ${count}개를 있던 그대로 복원했어요.`,
		"result.open": "글 목록 열기",
		"toast.done": ({ count }) => `글 ${count}개를 복원했어요.`,
		"error.run": "백업을 복원하지 못했어요. 아무것도 쓰지 않았어요.",
	},
});
