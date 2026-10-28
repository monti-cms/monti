import { Add } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * The name of an icon button, a small black pill that shows on hover or keyboard focus: 12px, one line, the key combination after it in mono when there
 * is one. Only names go in it, never a sentence, and a button with text needs none. `IconButton` carries one already; this part is for an icon that is not
 * an `IconButton` itself. The preview wraps every story in a `TooltipProvider`.
 */
const meta = {
	title: "Controls/Overlay/Tooltip",
	component: Tooltip,
	args: {},
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A plain icon button for the stories to hang a tooltip on. */
function IconTrigger({ label }: { label: string }) {
	return (
		<TooltipTrigger
			render={
				<button
					type="button"
					aria-label={label}
					className="inline-flex size-monti-icon-button items-center justify-center rounded-monti-full text-monti-muted outline-none hover:bg-monti-selected hover:text-monti-default"
				/>
			}
		>
			<Add aria-hidden className="size-4" />
		</TooltipTrigger>
	);
}

/** Hover or focus the button. */
export const Playground: Story = {
	render: (args) => (
		<Tooltip {...args}>
			<IconTrigger label="블록 추가" />
			<TooltipContent>블록 추가</TooltipContent>
		</Tooltip>
	),
};

/** Open on load, so the look is visible without hovering. */
export const Open: Story = {
	render: () => (
		<div className="p-monti-48">
			<Tooltip open>
				<IconTrigger label="블록 추가" />
				<TooltipContent side="bottom">블록 추가</TooltipContent>
			</Tooltip>
		</div>
	),
};

/** The key combination follows the name, in mono. */
export const WithShortcut: Story = {
	render: () => (
		<div className="p-monti-48">
			<Tooltip open>
				<IconTrigger label="저장" />
				<TooltipContent side="bottom" shortcut="⌘S">
					저장
				</TooltipContent>
			</Tooltip>
		</div>
	),
};

const SIDES = ["top", "right", "bottom", "left"] as const;

/** Four buttons far enough apart that each name sits on its own side without covering a neighbor. */
export const Sides: Story = {
	render: () => (
		<Stack direction="row" gap={0} justify="center" className="px-monti-32 py-monti-48">
			{SIDES.map((side) => (
				<div key={side} className="flex w-48 justify-center">
					<Tooltip open>
						<IconTrigger label={side} />
						<TooltipContent side={side}>{side}</TooltipContent>
					</Tooltip>
				</div>
			))}
		</Stack>
	),
};

export const Alignment: Story = {
	render: () => (
		<Stack direction="row" gap={0} className="px-monti-48 pt-monti-12 pb-monti-32">
			{(["start", "center", "end"] as const).map((align) => (
				<div key={align} className="flex w-48 justify-center">
					<Tooltip open>
						<IconTrigger label={align} />
						<TooltipContent side="bottom" align={align}>
							{align}
						</TooltipContent>
					</Tooltip>
				</div>
			))}
		</Stack>
	),
};
