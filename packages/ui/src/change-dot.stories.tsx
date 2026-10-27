import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChangeDot } from "./change-dot";
import { Stack } from "./stack";

/** A 6px dot after a name: this has something to deal with. Warning is an unsaved change; proposal is an assistant suggestion. */
const meta = { title: "Status/ChangeDot", component: ChangeDot } satisfies Meta<typeof ChangeDot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<Stack direction="row" gap={6} align="center">
				게시글
				<ChangeDot label="바뀜" />
			</Stack>
			<Stack direction="row" gap={6} align="center">
				SEO
				<ChangeDot tone="proposal" label="제안 있음" />
			</Stack>
		</Stack>
	),
};
