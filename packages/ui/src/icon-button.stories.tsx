import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal, PanelRight, Trash2, X } from "lucide-react";
import { ICON_BUTTON, IconButton } from "./icon-button";
import { Spark } from "./spark";
import { Stack } from "./stack";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

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
				<Spark className="size-monti-icon-md" />
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

/** The name shows on hover; `side` picks where. Here each side is held open on its own button, far enough apart that none covers another. */
export const TooltipSides: Story = {
	render: () => (
		<Stack direction="row" gap={0} justify="center" className="px-monti-32 py-monti-48">
			{(["top", "right", "bottom", "left"] as const).map((side) => (
				<div key={side} className="flex w-48 justify-center">
					<Tooltip open>
						<TooltipTrigger render={<button type="button" aria-label={side} className={ICON_BUTTON} />}>
							<MoreHorizontal aria-hidden />
						</TooltipTrigger>
						<TooltipContent side={side}>{side}</TooltipContent>
					</Tooltip>
				</div>
			))}
		</Stack>
	),
};
