import type { Meta, StoryObj } from "@storybook/react-vite";
import { Shortcut } from "./shortcut";
import { Stack } from "./stack";

/** A shortcut written for the system the admin runs on: "⇧⌘D" on a Mac (glyphs, no separator), "Ctrl+Shift+D" elsewhere. */
const meta = {
	title: "Primitives/Shortcut",
	component: Shortcut,
	args: { keys: ["mod", "S"] },
} satisfies Meta<typeof Shortcut>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** One modifier, two modifiers, and a named key. */
export const Keys: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<Shortcut keys={["mod", "S"]} />
			<Shortcut keys={["mod", "shift", "D"]} />
			<Shortcut keys={["alt", "ArrowUp"]} />
			<Shortcut keys={["Escape"]} />
		</Stack>
	),
};
