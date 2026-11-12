import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChangesGroup, type ChangesItem } from "./index";

const noop = () => {};

const ITEMS: ChangesItem[] = [
	{ id: "title", name: "사이트 이름", tag: "변경", tone: "warning", onUndo: noop },
	{ id: "ko", name: "언어 · 일본어", tag: "추가", tone: "success", onUndo: noop },
	{ id: "notes", name: "메모", tag: "컬렉션 삭제", tone: "danger", onUndo: noop },
];

/**
 * The save group in a settings title row while there are changes: "변경 사항 N ▾" opens the list with an undo per change, then "모두 되돌리기" and the one pill.
 * It does not appear when nothing changed.
 */
const meta = {
	title: "Monti/Change/ChangesGroup",
	component: ChangesGroup,
	args: {
		label: "변경 사항",
		listLabel: "변경 사항 목록",
		countLabel: "변경 사항 3개",
		items: ITEMS,
		undoLabel: "되돌리기",
		discardLabel: "모두 되돌리기",
		onDiscard: noop,
		saveLabel: "저장하고 적용",
		onSave: noop,
	},
} satisfies Meta<typeof ChangesGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Something blocks saving: the pill stays, disabled. */
export const Blocked: Story = { args: { saveDisabled: true } };

/** The save is on its way: the pill keeps its fill, turns its spinner and says so. It is not greyed. */
export const Saving: Story = { args: { saving: "저장 중…" } };

/** The changes delete saved values: the pill is red. */
export const Deletes: Story = { args: { saveDanger: true, saveLabel: "지우고 적용" } };

/** The assistant's proposals wait in the form: "· 제안 N" in blue after the count, and the list ends with them, each with its own discard. */
export const WithProposals: Story = {
	args: {
		proposals: {
			label: "제안",
			countLabel: "제안 2개",
			discardLabel: "버리기",
			items: [
				{ id: "preview", name: "미리보기 경로", onDiscard: noop },
				{ id: "locale-path", name: "주소에 언어 표시", onDiscard: noop },
			],
		},
	},
};
