import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Caret } from "./caret";
import { Stack } from "./stack";

/** The fold-out mark after a text button that opens a list. 12px, 6px from the text, centered on it. */
const meta = { title: "Controls/Field/Caret", component: Caret } satisfies Meta<typeof Caret>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** After text, alone in a button (`solo`), and following the text color (`ink`). */
export const Placement: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<Button variant="ghost" size="sm">
				필터
				<Caret />
			</Button>
			<Button variant="ghost" size="sm" aria-label="펼치기">
				<Caret solo />
			</Button>
			<span className="rounded-monti-full bg-monti-emphasis px-monti-12 py-monti-4 text-monti-on-emphasis">
				<Caret solo ink />
			</span>
		</Stack>
	),
};
