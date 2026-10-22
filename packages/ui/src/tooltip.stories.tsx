import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { Button } from "./button";
import { Stack } from "./stack";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = {
	title: "Overlays/Tooltip",
	component: Tooltip,
	args: {},
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Hover or focus the button. The preview wraps every story in a `TooltipProvider`. */
export const Playground: Story = {
	render: (args) => (
		<Tooltip {...args}>
			<TooltipTrigger render={<Button variant="outline" />}>새 글</TooltipTrigger>
			<TooltipContent>새 글 쓰기</TooltipContent>
		</Tooltip>
	),
};

/** Open on load, so the look is visible without hovering. Space is left around it for the four sides. */
export const Open: Story = {
	render: () => (
		<Tooltip open>
			<TooltipTrigger render={<Button variant="outline" />}>새 글</TooltipTrigger>
			<TooltipContent>새 글 쓰기</TooltipContent>
		</Tooltip>
	),
};

const SIDES = ["top", "right", "bottom", "left"] as const;

export const Sides: Story = {
	render: () => (
		<Stack direction="row" gap="section" align="center" justify="center" className="p-12">
			{SIDES.map((side) => (
				<Tooltip key={side} open>
					<TooltipTrigger render={<Button variant="outline" />}>{side}</TooltipTrigger>
					<TooltipContent side={side}>{side}에 표시</TooltipContent>
				</Tooltip>
			))}
		</Stack>
	),
};

export const IconButton: Story = {
	render: () => (
		<Tooltip open>
			<TooltipTrigger render={<Button size="icon" variant="outline" aria-label="추가" />}>
				<Plus aria-hidden />
			</TooltipTrigger>
			<TooltipContent side="bottom">블록 추가</TooltipContent>
		</Tooltip>
	),
};

/** The popup is `max-w-xs`: long text wraps. */
export const LongText: Story = {
	render: () => (
		<Tooltip open>
			<TooltipTrigger render={<Button variant="outline" />}>발행</TooltipTrigger>
			<TooltipContent side="bottom">
				발행하면 방문자에게 바로 보여요. 되돌리려면 글을 초안으로 바꾸면 돼요. 예약 발행도 쓸 수 있어요.
			</TooltipContent>
		</Tooltip>
	),
};

export const Alignment: Story = {
	render: () => (
		<Stack direction="row" gap="section" className="pt-12 pb-16">
			{(["start", "center", "end"] as const).map((align) => (
				<Tooltip key={align} open>
					<TooltipTrigger render={<Button variant="outline" />}>{align}</TooltipTrigger>
					<TooltipContent side="bottom" align={align}>
						align {align}
					</TooltipContent>
				</Tooltip>
			))}
		</Stack>
	),
};
