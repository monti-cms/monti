import { Close, OverflowMenuHorizontal, RightPanelOpen, TrashCan } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ICON_BUTTON, IconButton } from "./icon-button";
import { Spark } from "./spark";
import { Stack } from "./stack";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

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
				<Spark className="size-monti-icon-md" />
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

/** The name shows on hover; `side` picks where. Here each side is held open on its own button, far enough apart that none covers another. */
export const TooltipSides: Story = {
	render: () => (
		<Stack direction="row" gap={0} justify="center" className="px-monti-32 py-monti-48">
			{(["top", "right", "bottom", "left"] as const).map((side) => (
				<div key={side} className="flex w-48 justify-center">
					<Tooltip open>
						<TooltipTrigger render={<button type="button" aria-label={side} className={ICON_BUTTON} />}>
							<OverflowMenuHorizontal aria-hidden />
						</TooltipTrigger>
						<TooltipContent side={side}>{side}</TooltipContent>
					</Tooltip>
				</div>
			))}
		</Stack>
	),
};
