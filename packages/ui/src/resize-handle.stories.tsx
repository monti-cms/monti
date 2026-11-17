import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Inline, ResizablePane, Text } from "./index";

/** A column whose width the person can change: the handle on one edge, a hairline on that side; the width is remembered, between a least and a most. */
const meta = {
	title: "Patterns/Frame/ResizablePane",
	parameters: { bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A list beside its detail: the handle on the right edge (`end`). */
export const End: Story = {
	render: () => (
		<Inline align="stretch" gap={0}>
			<ResizablePane resizeKey="story-list" defaultWidth={320} min={240} max={480} label="목록 너비">
				<Box padding={16}>
					<Text variant="note">목록</Text>
				</Box>
			</ResizablePane>
			<Box padding={16} grow>
				<Text variant="note">자세히</Text>
			</Box>
		</Inline>
	),
};

/** The handle on the left edge (`start`), for a column at the right. */
export const Start: Story = {
	render: () => (
		<Inline align="stretch" gap={0} justify="end">
			<ResizablePane resizeKey="story-side" defaultWidth={300} min={240} max={420} label="패널 너비" edge="start">
				<Box padding={16}>
					<Text variant="note">패널</Text>
				</Box>
			</ResizablePane>
		</Inline>
	),
};
