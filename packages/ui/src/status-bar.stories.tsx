import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBar, StatusBarCell, StatusBarPluginCell, StatusBarSpacer } from "./index";

/** The bar under the editor (30px, tool ground, a rule above, mono 12): only what is not shown anywhere else. */
const meta = {
	title: "Patterns/Frame/StatusBar",
	component: StatusBar,
	args: { "aria-label": "상태" },
	parameters: { bleed: true },
} satisfies Meta<typeof StatusBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Cells to fix at the left (a dot before them), counts at the right behind the spacer. */
export const Cells: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarCell tone="danger">발행 전 고칠 것 1</StatusBarCell>
			<StatusBarCell tone="warning">할 일 3</StatusBarCell>
			<StatusBarCell detail="쓰는 중 1">요청 1</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				1,284자
			</StatusBarCell>
		</StatusBar>
	),
};

/** A cell that only states something has no dot and is not a button; one that goes somewhere is a link. */
export const Plain: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarCell tone="warning" dot={false} href="#">
				원문에서 변경 사항 2
			</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				저장됨 · 오후 3:12
			</StatusBarCell>
		</StatusBar>
	),
};

/** The cell a plugin fills: its name and count, and its list of findings with "Fix all". */
export const Plugin: Story = {
	render: (args) => (
		<StatusBar {...args}>
			<StatusBarPluginCell
				label="맞춤법"
				defaultOpen
				findings={[
					{ id: "1", title: "됬어요 → 됐어요", detail: "둘째 문단", actionLabel: "고치기", onAction: () => {} },
					{ id: "2", title: "몇일 → 며칠", detail: "제목", actionLabel: "고치기", onAction: () => {} },
				]}
				settings={{ label: "설정", onClick: () => {} }}
				fixAll={{ label: "모두 고치기", onClick: () => {} }}
			/>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				1,284자
			</StatusBarCell>
		</StatusBar>
	),
};
