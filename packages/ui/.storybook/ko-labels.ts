import type { UiLabels } from "../src/labels";

/**
 * The words the components write themselves, in Korean: what the admin shows when its language is Korean. Storybook gives them to every story by default
 * (the toolbar can switch to the English defaults). The admin's own dictionaries are the source; `packages/admin/src/__test__/ui-labels.test.ts` fails
 * when this list and what `AdminUiLabels` gives the components differ.
 */
export const KO_UI_LABELS: UiLabels = {
	close: "닫기",
	cancel: "취소",
	save: "저장",
	saving: "저장 중…",
	loading: "불러오는 중",
	clear: "지우기",
	deselect: "선택 해제",
	aiFill: "채우기",
	aiAgain: "다시",
	aiWorking: "쓰는 중…",
	proposal: "AI 제안",
	blocking: "발행을 막아요",
	footnoteMark: "각¹",
	paginationLabel: "페이지 이동",
	paginationPrevious: "이전",
	paginationPreviousPage: "이전 페이지",
	paginationNext: "다음",
	paginationNextPage: "다음 페이지",
	paginationMore: "다른 페이지",
	sidebarTitle: "사이드바",
	sidebarDescription: "모바일 사이드바를 보여 줘요.",
	sidebarToggle: "사이드바 열기",
	sidebarResize: "사이드바 너비 조절",
	resize: "패널 너비 조절",
};
