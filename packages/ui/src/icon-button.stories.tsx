import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./icon-button";
import { ArrowUp, Close, OverflowMenuHorizontal, RightPanelOpen, TrashCan } from "./icons";
import { Spark } from "./spark";
import { Stack } from "./stack";

/** Round, 32px: the header's more (⋯), properties and assistant, a panel's close. The label is the screen reader name and the tooltip. */
const meta = {
	title: "Controls/Button/IconButton",
	component: IconButton,
	args: { label: "더보기", children: <OverflowMenuHorizontal aria-hidden /> },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Rest, pressed (the properties panel is open), disabled. */
export const States: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<IconButton label="더보기">
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<IconButton label="속성" pressed>
				<RightPanelOpen aria-hidden />
			</IconButton>
			<IconButton label="어시스턴트 열기">
				<Spark aria-hidden />
			</IconButton>
			<IconButton label="닫기">
				<Close aria-hidden />
			</IconButton>
			<IconButton label="비활성" disabled>
				<Close aria-hidden />
			</IconButton>
		</Stack>
	),
};

/** The three sizes, `md` 32px, `sm` 28px, `xs` 24px (a row's ⋯), then `tone="quiet"`: faint until pointed at (a message's actions). */
export const Sizes: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<IconButton label="더보기">
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<IconButton label="더보기" size="sm">
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<IconButton label="더보기" size="xs">
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<IconButton label="지우기" size="xs" tone="quiet">
				<TrashCan aria-hidden />
			</IconButton>
		</Stack>
	),
};

/** `tone="danger"` is for a button that deletes or removes something: a red icon, and the red wash on hover. */
export const Danger: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<IconButton label="규칙 지우기" tone="danger">
				<TrashCan aria-hidden />
			</IconButton>
			<IconButton label="비활성" tone="danger" disabled>
				<TrashCan aria-hidden />
			</IconButton>
		</Stack>
	),
};

/** `variant="primary"`: the black round button that sends (the assistant's box, a note's reply), at `md` 32px and `sm` 28px, then disabled. */
export const Primary: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<IconButton label="보내기" variant="primary">
				<ArrowUp aria-hidden />
			</IconButton>
			<IconButton label="보내기" variant="primary" size="sm">
				<ArrowUp aria-hidden />
			</IconButton>
			<IconButton label="보내기" variant="primary" disabled>
				<ArrowUp aria-hidden />
			</IconButton>
		</Stack>
	),
};
