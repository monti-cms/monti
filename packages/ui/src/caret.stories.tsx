import type { Meta, StoryObj } from "@storybook/react-vite";
import { Caret } from "./caret";
import { Stack } from "./stack";
import { TextButton } from "./text-button";

/** The fold-out mark after a text button that opens a list. 12px, 6px from the text, centered on it. */
const meta = { title: "Controls/Field/Caret", component: Caret } satisfies Meta<typeof Caret>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** After text, alone in a button (`solo`), and following the text color (`ink`). */
export const Placement: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<TextButton>
				필터
				<Caret />
			</TextButton>
			<TextButton aria-label="펼치기">
				<Caret solo />
			</TextButton>
			<span className="rounded-monti-full bg-monti-emphasis px-monti-12 py-monti-4 text-monti-on-emphasis">
				<Caret solo ink />
			</span>
		</Stack>
	),
};
