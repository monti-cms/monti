import type { Meta, StoryObj } from "@storybook/react-vite";
import { DragHandle } from "./drag-handle";
import { Stack } from "./stack";
import { Text } from "./text";

/** The handle of a sortable row: six dots, faint until pointed at. Its name says whose row it moves. */
const meta = {
	title: "Controls/Button/DragHandle",
	component: DragHandle,
	args: { "aria-label": "한국어 옮기기" },
} satisfies Meta<typeof DragHandle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** At the start of a row; point at it to see it turn ink. */
export const InRow: Story = {
	render: () => (
		<Stack gap={8}>
			{["한국어", "English", "日本語"].map((name) => (
				<Stack key={name} direction="row" gap={8} align="center">
					<DragHandle aria-label={`${name} 옮기기`} />
					<Text variant="note">{name}</Text>
				</Stack>
			))}
		</Stack>
	),
};
