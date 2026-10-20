import { defineMessages } from "@monti-cms/core";
import { enNoun, koNoun } from "../shared/noun.messages";

const one = (count: unknown) => Number(count) === 1;

/**
 * Text of the export: the Site backup card on the Data page, the dialog of selected entries and of one entry, and the counts all of them show.
 * `noun` is the label of the collection when the export is of the entries of one (the bulk bar, the editor).
 */
export const exportMessages = defineMessages("cms-admin.export", {
	en: {
		"summary.entries": (vars) => {
			const count = Number(vars.count);
			return String(vars.noun ?? "").trim()
				? `${count} ${enNoun(vars)} ${one(count) ? "entry" : "entries"}`
				: `${count} ${one(count) ? "entry" : "entries"}`;
		},
		"summary.translations": ({ count }) => `${count} ${one(count) ? "translation" : "translations"}`,
		"summary.empty": "Nothing to export with these choices.",
		"summary.includes": "In the archive",
		"count.entries": "Entries",
		"count.templates": "Templates",
		"count.folders": "Folders",
		"count.addresses": "Addresses",
		"count.media": "Media records",
		"note.media": "Media files are not included. They stay in your storage; the archive lists their records only.",
		"note.translations": "The translations of the selected entries always come along.",
		"note.selection":
			"Only the folders, addresses and media records these entries use are included. Templates and preferences are not.",
		"note.notPublished": ({ count }) =>
			`${count} ${one(count) ? "entry is" : "entries are"} not published, so a public archive leaves ${one(count) ? "it" : "them"} out.`,
		"note.notFound": ({ count }) =>
			`${count} selected ${one(count) ? "entry was" : "entries were"} not found and ${one(count) ? "is" : "are"} left out.`,
		"note.unsaved": "Changes you have not saved are not included. Save first to include them.",
		"scope.label": "Archive for",
		"scope.admin": "Backup (with drafts)",
		"scope.admin.hint":
			"Drafts and published entries, templates, folders, addresses, media records and preferences. Made to be imported again.",
		"scope.public": "Public (published only)",
		"scope.public.hint": "Published entries only, as readers see them. No drafts, templates or preferences.",
		"formats.label": "Files in the archive",
		"formats.json": "JSON documents",
		"formats.json.hint": "Always included. The stored documents, with everything an import needs.",
		"formats.text": ({ label, extension }) => `${label} files (.${extension})`,
		"formats.text.hint": "Each body also as readable text, next to its JSON.",
		"formats.one": "An archive holds one text format. Choosing another replaces this one.",
		"formats.none": "No text format is installed. Install @monti-cms/mdx to also get MDX files.",
		"formats.failed": "Could not read which formats are installed. The archive will hold JSON only.",
		"summary.loading": "Counting…",
		"summary.failed": "Could not count what the export holds.",
		"action.all": "Export everything",
		"action.selected": "Export",
		"action.cancel": "Cancel",
		"progress.building": "Building the archive…",
		"progress.downloading": ({ percent }) => `Downloading… ${percent}%`,
		"progress.downloadingUnknown": "Downloading…",
		"toast.done": ({ name }) => `Saved ${name}.`,
		"toast.notWritten": ({ count }) =>
			`${count} ${one(count) ? "body was" : "bodies were"} kept as JSON only because the format could not write ${one(count) ? "it" : "them"}.`,
		"error.export": "The export could not be made.",
		"data.title": "Site backup",
		"data.description": "Everything in this site in one archive you can keep, or import again later.",
		"menu.exportEntry": "Export this entry",
		"dialog.title.entry": "Export this entry",
		"dialog.title.selected": ({ count, ...vars }) =>
			`Export ${count} selected ${String(vars.noun ?? "").trim() ? `${enNoun(vars)} ` : ""}${one(count) ? "entry" : "entries"}`,
		"dialog.description": "This is what goes into the archive.",
	},
	ko: {
		"summary.entries": (vars) => `${koNoun(vars)} ${vars.count}개`,
		"summary.translations": ({ count }) => `번역 ${count}개`,
		"summary.empty": "이 설정으로는 내보낼 것이 없어요.",
		"summary.includes": "보관 파일에 담기는 것",
		"count.entries": "항목",
		"count.templates": "템플릿",
		"count.folders": "폴더",
		"count.addresses": "주소",
		"count.media": "미디어 기록",
		"note.media": "미디어 파일은 담기지 않고 저장소에 그대로 있어요. 보관 파일에는 기록만 들어가요.",
		"note.translations": "선택한 글의 번역은 항상 함께 담겨요.",
		"note.selection": "이 글들이 쓰는 폴더, 주소, 미디어 기록만 담겨요. 템플릿과 환경설정은 담기지 않아요.",
		"note.notPublished": ({ count }) => `발행되지 않은 ${count}개는 공개용 보관 파일에서 빠져요.`,
		"note.notFound": ({ count }) => `선택한 글 중 ${count}개는 찾지 못해서 빠져요.`,
		"note.unsaved": "저장하지 않은 변경은 담기지 않아요. 먼저 저장하면 함께 담겨요.",
		"scope.label": "보관 파일의 용도",
		"scope.admin": "백업용 (초안 포함)",
		"scope.admin.hint":
			"초안과 발행된 글, 템플릿, 폴더, 주소, 미디어 기록, 환경설정을 담아요. 나중에 다시 가져올 수 있게 만들어요.",
		"scope.public": "공개용 (발행본만)",
		"scope.public.hint": "독자가 보는 모습 그대로 발행된 글만 담아요. 초안, 템플릿, 환경설정은 없어요.",
		"formats.label": "보관 파일에 담을 파일",
		"formats.json": "JSON 문서",
		"formats.json.hint": "항상 담겨요. 가져오기에 필요한 것을 모두 담은 저장 문서예요.",
		"formats.text": ({ label, extension }) => `${label} 파일 (.${extension})`,
		"formats.text.hint": "본문마다 JSON 옆에 읽기 쉬운 글 파일도 함께 담아요.",
		"formats.one": "보관 파일에는 글 형식을 하나만 담아요. 다른 형식을 고르면 지금 것이 해제돼요.",
		"formats.none": "설치된 글 형식이 없어요. MDX 파일도 받으려면 @monti-cms/mdx를 설치하세요.",
		"formats.failed": "설치된 형식을 읽지 못했어요. 보관 파일에는 JSON만 담겨요.",
		"summary.loading": "세는 중…",
		"summary.failed": "담길 내용을 세지 못했어요.",
		"action.all": "전체 내보내기",
		"action.selected": "내보내기",
		"action.cancel": "취소",
		"progress.building": "보관 파일을 만드는 중…",
		"progress.downloading": ({ percent }) => `내려받는 중… ${percent}%`,
		"progress.downloadingUnknown": "내려받는 중…",
		"toast.done": ({ name }) => `${name} 파일을 저장했어요.`,
		"toast.notWritten": ({ count }) => `본문 ${count}개는 형식이 쓰지 못해서 JSON으로만 담았어요.`,
		"error.export": "내보내지 못했어요.",
		"data.title": "사이트 백업",
		"data.description": "이 사이트의 모든 내용을 보관 파일 하나로 담아요. 보관하거나 나중에 다시 가져올 수 있어요.",
		"menu.exportEntry": "이 글 내보내기",
		"dialog.title.entry": "이 글 내보내기",
		"dialog.title.selected": (vars) => `선택한 ${koNoun(vars)} ${vars.count}개 내보내기`,
		"dialog.description": "보관 파일에 담기는 내용이에요.",
	},
});
