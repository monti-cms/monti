import type { Meta, StoryObj } from "@storybook/react-vite";
import { Grip } from "./grip";
import { Stack } from "./stack";
import { Text } from "./text";

/** The six dots a thing is dragged by. It takes the color of the text around it. */
const meta = { title: "Primitives/Grip", component: Grip } satisfies Meta<typeof Grip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** In the ink of the line it stands in. */
export const InText: Story = {
	render: () => (
		<Stack gap={12}>
			<Text variant="note">
				<Stack as="span" direction="row" gap={8} align="center">
					<Grip />
					한국어
				</Stack>
			</Text>
			<Text variant="note" tone="faint">
				<Stack as="span" direction="row" gap={8} align="center">
					<Grip />
					English
				</Stack>
			</Text>
		</Stack>
	),
};
