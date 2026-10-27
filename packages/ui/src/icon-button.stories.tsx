import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal, PanelRight, Trash2, X } from "lucide-react";
import { Spark } from "./ai-action";
import { IconButton } from "./icon-button";
import { Stack } from "./stack";

/** Round, 32px: the header's more (⋯), properties and assistant, a panel's close. The label is the screen reader name and the tooltip. */
const meta = {
	title: "Controls/Button/IconButton",
	component: IconButton,
	args: { label: "더보기", children: <MoreHorizontal aria-hidden /> },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Rest, pressed (the properties panel is open), disabled. */
export const States: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<IconButton label="더보기">
				<MoreHorizontal aria-hidden />
			</IconButton>
			<IconButton label="속성" pressed>
				<PanelRight aria-hidden />
			</IconButton>
			<IconButton label="어시스턴트 열기">
				<Spark className="size-4" />
			</IconButton>
			<IconButton label="닫기">
				<X aria-hidden />
			</IconButton>
			<IconButton label="비활성" disabled>
				<X aria-hidden />
			</IconButton>
		</Stack>
	),
};

/** `tone="danger"` is for a button that deletes or removes something: a red icon, and the red wash on hover. */
export const Danger: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<IconButton label="규칙 지우기" tone="danger">
				<Trash2 aria-hidden />
			</IconButton>
			<IconButton label="비활성" tone="danger" disabled>
				<Trash2 aria-hidden />
			</IconButton>
		</Stack>
	),
};

/** The tooltip appears on hover; `side` picks where. */
export const TooltipSides: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			{(["top", "bottom", "left", "right"] as const).map((side) => (
				<IconButton key={side} label={`툴팁 ${side}`} side={side}>
					<MoreHorizontal aria-hidden />
				</IconButton>
			))}
		</Stack>
	),
};
