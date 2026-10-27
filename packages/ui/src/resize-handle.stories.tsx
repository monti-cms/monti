import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Box } from "./box";
import { ResizablePane } from "./resize-handle";
import { Inline } from "./stack";
import { Text } from "./text";

function Demo({ resizeKey }: { resizeKey: string }) {
	return (
		<Inline align="stretch" gap={0} minHeight="screen">
			<ResizablePane resizeKey={resizeKey} defaultWidth={288} min={224} max={384} label="목록 너비 조절">
				<Box padding={16}>
					<Text>목록</Text>
				</Box>
			</ResizablePane>
			<Box padding={16} grow>
				<Text tone="muted">
					가장자리를 끌거나, 포커스를 두고 방향키로 너비를 바꿔요. 두 번 누르면 처음 너비로 돌아가요.
				</Text>
			</Box>
		</Inline>
	);
}

const meta = {
	title: "Frame/ResizeHandle",
	component: ResizablePane,
	args: { resizeKey: "story", defaultWidth: 288, min: 224, max: 384 },
	render: () => <Demo resizeKey="story-rest" />,
} satisfies Meta<typeof ResizablePane>;
export default meta;
type Story = StoryObj<typeof meta>;

/** At rest the handle is invisible: only the pane's own hairline shows. */
export const Rest: Story = {};

/** Pointed at: a 1px accent line on the edge, inside a wider hit area. */
export const Hover: Story = {
	render: () => <Demo resizeKey="story-hover" />,
	play: async ({ canvasElement }) => {
		await userEvent.hover(within(canvasElement).getByRole("separator", { name: "목록 너비 조절" }));
	},
};

/** Focused with the keyboard: the same line; ←/→ change the width (Shift for bigger steps). */
export const Focused: Story = {
	render: () => <Demo resizeKey="story-focus" />,
	play: async ({ canvasElement }) => {
		const handle = within(canvasElement).getByRole("separator", { name: "목록 너비 조절" });
		await userEvent.tab();
		await expect(handle).toHaveFocus();
	},
};
