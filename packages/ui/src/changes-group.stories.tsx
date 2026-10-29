import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChangesGroup, type ChangesItem } from "./changes-group";
import { PageHeader } from "./page-header";

/**
 * The save group of a settings screen's title row: how many places changed (it opens the list, each with its own undo), undo all, and the primary pill.
 * The pill stays but is disabled while the screen has an error that blocks saving.
 */
const meta = {
	title: "Controls/Button/ChangesGroup",
	component: ChangesGroup,
	tags: ["visual"],
	parameters: { layout: "padded" },
} satisfies Meta<typeof ChangesGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

const initial: ChangesItem[] = [
	{ id: "a", name: "요약", tag: "이름", tone: "warning", onUndo: () => {} },
	{ id: "b", name: "부제", tag: "지움", tone: "danger", onUndo: () => {} },
	{ id: "c", name: "글 종류", tag: "새로", tone: "success", onUndo: () => {} },
];

function Demo({ saveDisabled }: { saveDisabled?: boolean }) {
	const [items, setItems] = useState(initial);
	return (
		<div className="max-w-[880px]">
			<PageHeader title="설정">
				<ChangesGroup
					label="바뀐 곳"
					listLabel="바뀐 곳 목록"
					countLabel={`바뀐 곳 ${items.length}개`}
					items={items.map((item) => ({
						...item,
						onUndo: () => setItems((list) => list.filter((one) => one.id !== item.id)),
					}))}
					undoLabel="되돌리기"
					discardLabel="모두 되돌리기"
					onDiscard={() => setItems([])}
					saveLabel="저장하고 적용"
					onSave={() => {}}
					saveDisabled={saveDisabled}
				/>
			</PageHeader>
		</div>
	);
}

export const Playground: Story = { args: {} as never, render: () => <Demo /> };

/** An error stops saving: the pill is there, off. */
export const SaveBlocked: Story = { args: {} as never, render: () => <Demo saveDisabled /> };

/** Values will be deleted: the pill is red and says what it does. */
export const Dropping: Story = {
	args: {} as never,
	render: () => (
		<div className="max-w-[880px]">
			<PageHeader title="설정">
				<ChangesGroup
					label="바뀐 곳"
					listLabel="바뀐 곳 목록"
					countLabel="바뀐 곳 3개"
					items={initial}
					undoLabel="되돌리기"
					discardLabel="모두 되돌리기"
					onDiscard={() => {}}
					saveLabel="지우고 적용"
					saveDanger
					onSave={() => {}}
				/>
			</PageHeader>
		</div>
	),
};
