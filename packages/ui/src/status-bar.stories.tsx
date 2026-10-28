import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBar, StatusBarAnnouncer, StatusBarCell, StatusBarPluginCell, StatusBarSpacer } from "./status-bar";
import { StatusBarList } from "./status-bar-list";
import { TodoDone, TodoItem } from "./todo-item";

/**
 * The bar under the editor. It shows only what is nowhere else: the things to fix, the assistant's requests, the character count, and it is not
 * drawn while it has no cell. A cell is as tall as the bar, with a short rule after it; the one whose list is open takes the selected background,
 * and a cell with something to fix carries a dot in the warning color (red while it stops publishing).
 */
const meta = {
	title: "Patterns/Frame/StatusBar",
	component: StatusBar,
	args: { "aria-label": "상태" },
	parameters: { bleed: true },
	decorators: [
		(Story) => (
			<div className="flex min-h-screen flex-col justify-end">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof StatusBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The to-do cell, open: the list opens upward from it, and its rows go to the places to fix. */
export const Playground: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarList
				defaultOpen
				label="할 일"
				count={2}
				countTone="danger"
				trigger={<StatusBarCell tone="danger">할 일 2</StatusBarCell>}
			>
				<TodoItem blocking title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={() => {}} />
				<TodoItem
					title="영어 번역이 일부만 채워졌어요"
					detail="영어 · 문단 3개"
					proposal
					actionLabel="채우기"
					onAction={() => {}}
				/>
				<TodoDone>요약, 태그 확인함</TodoDone>
			</StatusBarList>
			<StatusBarCell>요청 2 · 1 고치는 중</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				1,240자
			</StatusBarCell>
		</StatusBar>
	),
};

/** At rest: the cells side by side. Cells that only state something are not buttons. The announcer says the state aloud and shows nothing. */
export const Cells: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarAnnouncer>저장됨</StatusBarAnnouncer>
			<StatusBarCell tone="warning">할 일 2</StatusBarCell>
			<StatusBarCell>요청 2 · 1 고치는 중</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				1,240자
			</StatusBarCell>
		</StatusBar>
	),
};

/** A cell whose list is open, without the list: the selected background fills the cell's full height. */
export const CellOpen: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarCell tone="warning" data-popup-open="">
				할 일 2
			</StatusBarCell>
			<StatusBarCell>요청 2</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				1,240자
			</StatusBarCell>
		</StatusBar>
	),
};

/** A cell a plugin fills: the name and the count, one row per finding with its own action, then the way to the plugin's settings and "fix all". With nothing to fix it is not drawn at all, like every cell. */
export const PluginCell: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarPluginCell
				defaultOpen
				label="맞춤법"
				findings={[
					{
						id: "a",
						title: "됬다 → 됐다",
						detail: "둘째 문단",
						actionLabel: "고치기",
						onAction: () => {},
						onOpen: () => {},
					},
					{ id: "b", title: "안되 → 안 돼", detail: "넷째 문단", actionLabel: "고치기", onAction: () => {} },
				]}
				settings={{ label: "설정", onClick: () => {} }}
				fixAll={{ label: "모두 고치기", onClick: () => {} }}
			/>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				1,240자
			</StatusBarCell>
		</StatusBar>
	),
};

/** A plugin finding that stops publishing makes its cell red, like the to-do cell. */
export const BlockingFinding: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarPluginCell
				defaultOpen
				label="링크 검사"
				findings={[
					{
						id: "a",
						title: "깨진 링크 → 주소 확인",
						detail: "/posts/old-title",
						blocking: true,
						actionLabel: "이동",
						onAction: () => {},
					},
				]}
				settings={{ label: "설정", onClick: () => {} }}
			/>
			<StatusBarSpacer />
		</StatusBar>
	),
};
