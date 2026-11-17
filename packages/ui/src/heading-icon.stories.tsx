import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeadingIcon } from "./heading-icon";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

/** The heading block's glyph: the heading mark with its level as a tiny mono number at the bottom right, so 제목 2, 3 and 4 are told apart at 16px. */
const meta = { title: "Primitives/HeadingIcon", component: HeadingIcon, args: { level: 2 } } satisfies Meta<
	typeof HeadingIcon
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Levels: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			{[2, 3, 4].map((level) => (
				<Stack key={level} gap={4} align="center">
					<HeadingIcon level={level} />
					<StoryCaption>제목 {level}</StoryCaption>
				</Stack>
			))}
		</Stack>
	),
};
