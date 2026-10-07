import { defineMessages } from "@monti-cms/core";
import { josa } from "@monti-cms/core/client";
import { enSelected, koSelected } from "../shared/noun";

/** English: the generic noun in the right number ("1 selected item" / "3 selected items"). */
const selected = (count: unknown, noun: string) => `${count} selected ${noun}${Number(count) === 1 ? "" : "s"}`;

/** Korean: picks the "으로"/"로" particle by final consonant ("로" after no final or ㄹ). */
const toward = (word: string) => {
	const code = word.charCodeAt(word.length - 1) - 0xac00;
	const final = code >= 0 && code <= 11171 ? code % 28 : 0;
	return `${word}${final === 0 || final === 8 ? "로" : "으로"}`;
};

/** Messages for the bulk action bar. */
export const bulkBarMessages = defineMessages("cms-admin.entries.bulk-bar", {
	en: {
		"relation.add": "Add {label}",
		"relation.remove": "Remove {label}",
		"relation.set": "Change {label}",
		"ask.relation.add": ({ label, target, ...vars }) => `Add ${label} '${target}' to ${enSelected(vars)}?`,
		"ask.relation.remove": ({ label, target, ...vars }) => `Remove ${label} '${target}' from ${enSelected(vars)}?`,
		"ask.relation.clear": ({ label, ...vars }) => `Clear ${label} of ${enSelected(vars)}?`,
		"ask.relation.set": ({ label, target, ...vars }) => `Change ${label} of ${enSelected(vars)} to '${target}'?`,
		"folder.move": "Move to folder",
		"ask.folder.move": ({ count, target }) => `Move ${selected(count, "item")} to '${target}'?`,
		"ask.folder.root": ({ count }) => `Move ${selected(count, "item")} to the top level?`,
		publish: "Publish",
		"ask.publish": (vars) => `Publish ${enSelected(vars)}? Each is checked first, and the latest draft goes live.`,
		archive: "Archive",
		"ask.archive": (vars) => `Archive ${enSelected(vars)}? They will no longer be public.`,
		unarchive: "Unarchive",
		"ask.unarchive": (vars) =>
			`Unarchive ${enSelected(vars)}? They go back to draft and aren't republished automatically.`,
		trash: "Move to trash",
		"ask.trash": ({ count }) => `Move ${selected(count, "item")} to the trash? They will no longer be public.`,
		permanentDelete: "Delete permanently",
		"ask.permanentDelete": ({ count }) =>
			`Permanently delete ${selected(count, "item")}? This can't be undone. Items used by other content aren't deleted; the reason is shown instead.`,
		"failure.conflict": "It was changed elsewhere first. Refresh the list and try again.",
		"failure.not_found": "It was deleted or doesn't exist.",
		"failure.invalid_input": "This can't be applied to this item.",
		"failure.invalid_status": "This can't be done in the current state.",
		"failure.publish_validation_failed": "It didn't pass the publish check.",
		"failure.slug_conflict": "The same address is already in use.",
		"failure.in_use": "Other content is using it.",
		"failure.invalid_reference": "It references an item in the trash.",
		"failure.usedBy": "In use by: {names}",
		"failure.more": "{names} and {more} more",
		untitled: "Untitled",
		requestFailed: "The bulk action request failed.",
		failed: "The bulk action failed.",
		"picker.select": "Select {label}",
		"picker.more": "{first} and {more} more",
		"picker.aria": "{label} to apply: {names}",
		"picker.none": "None",
		"picker.search": "Search {label}",
		"picker.empty": "No matching {label}.",
		bar: "Bulk actions",
		count: "{count} selected",
		clear: "Clear selection",
		kind: "Bulk action",
		"target.aria": "Target {label}",
		"folder.aria": "Folder to move to",
		"folder.select": "Select folder",
		running: "Running…",
		run: "Run",
		result: "Succeeded {success} · Failed {failed}",
		retry: "Retry failed",
		"option.none": "None",
		"option.root": "Top level",
	},
	ko: {
		"relation.add": "{label} 추가",
		"relation.remove": "{label} 빼기",
		"relation.set": "{label} 바꾸기",
		"ask.relation.add": ({ label, target, ...vars }) =>
			`${koSelected(vars)}에 '${target}' ${josa(String(label), "을", "를")} 추가할까요?`,
		"ask.relation.remove": ({ label, target, ...vars }) =>
			`${koSelected(vars)}에서 '${target}' ${josa(String(label), "을", "를")} 뺄까요?`,
		"ask.relation.clear": ({ label, ...vars }) => `${koSelected(vars)}의 ${josa(String(label), "을", "를")} 비울까요?`,
		"ask.relation.set": ({ label, target, ...vars }) =>
			`${koSelected(vars)}의 ${josa(String(label), "을", "를")} ${toward(`'${target}'`)} 바꿀까요?`,
		"folder.move": "폴더로 이동",
		"ask.folder.move": "선택한 항목 {count}개를 '{target}' 폴더로 이동할까요?",
		"ask.folder.root": "선택한 항목 {count}개를 최상위로 이동할까요?",
		publish: "발행",
		"ask.publish": (vars) => `${koSelected(vars)}를 발행할까요? 각각 발행 검증을 적용하고 최신 초안이 공개됩니다.`,
		archive: "보관",
		"ask.archive": (vars) => `${koSelected(vars)}를 보관할까요? 공개가 종료됩니다.`,
		unarchive: "보관 해제",
		"ask.unarchive": (vars) =>
			`${koSelected(vars)}의 보관을 해제할까요? 초안으로 돌아가고 자동으로 다시 공개하지 않습니다.`,
		trash: "휴지통으로 이동",
		"ask.trash": "선택한 항목 {count}개를 휴지통으로 이동할까요? 공개가 종료됩니다.",
		permanentDelete: "영구 삭제",
		"ask.permanentDelete":
			"선택한 항목 {count}개를 영구 삭제할까요? 되돌릴 수 없습니다. 다른 콘텐츠가 쓰는 항목은 삭제하지 않고 사유를 보여 줍니다.",
		"failure.conflict": "다른 곳에서 먼저 바뀌었습니다. 목록을 새로고침한 뒤 다시 실행하세요.",
		"failure.not_found": "삭제되었거나 없습니다.",
		"failure.invalid_input": "이 항목에는 적용할 수 없습니다.",
		"failure.invalid_status": "현재 상태에서는 할 수 없는 작업입니다.",
		"failure.publish_validation_failed": "발행 검증을 통과하지 못했습니다.",
		"failure.slug_conflict": "같은 주소가 이미 사용 중입니다.",
		"failure.in_use": "다른 콘텐츠가 사용 중입니다.",
		"failure.invalid_reference": "휴지통에 있는 항목을 참조합니다.",
		"failure.usedBy": "사용 중: {names}",
		"failure.more": "{names} 외 {more}개",
		untitled: "제목 없음",
		requestFailed: "일괄 작업 요청이 실패했습니다.",
		failed: "일괄 작업이 실패했습니다.",
		"picker.select": "{label} 선택",
		"picker.more": "{first} 외 {more}개",
		"picker.aria": "적용할 {label}: {names}",
		"picker.none": "없음",
		"picker.search": "{label} 검색",
		"picker.empty": ({ label }) => `일치하는 ${josa(String(label), "이", "가")} 없습니다.`,
		bar: "일괄 작업",
		count: "{count}개 선택",
		clear: "선택 해제",
		kind: "일괄 작업 종류",
		"target.aria": "대상 {label}",
		"folder.aria": "이동할 폴더",
		"folder.select": "폴더 선택",
		running: "실행 중…",
		run: "실행",
		result: "성공 {success} · 실패 {failed}",
		retry: "실패만 다시 실행",
		"option.none": "없음",
		"option.root": "최상위",
	},
});
