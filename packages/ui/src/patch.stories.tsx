import type { Meta, StoryObj } from "@storybook/react-vite";
import { Patch } from "./patch";

/**
 * What changes in a file: its name and the numbers of lines added and taken out in the head, then the lines. Added lines are green with a +, removed lines red
 * with a −, and the lines around them are dimmed.
 */
const meta = {
	title: "Monti/Change/Patch",
	component: Patch,
	args: {
		file: "monti.schema.ts · memo",
		actionLabel: "복사",
		onAction: () => undefined,
		lines: [
			{ type: "same", text: "fields: {" },
			{ type: "add", text: "  summary: {" },
			{ type: "add", text: '    kind: "text",' },
			{ type: "add", text: "  }," },
			{ type: "remove", text: '  subtitle: { kind: "text" },' },
			{ type: "same", text: "}," },
		],
	},
	decorators: [
		(Story) => (
			<div className="w-[340px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Patch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Nothing added (only lines taken out): only the red count in the head; and no action. */
export const OnlyRemoved: Story = {
	args: {
		actionLabel: undefined,
		lines: [
			{ type: "same", text: "fields: {" },
			{ type: "remove", text: '  subtitle: { kind: "text" },' },
			{ type: "same", text: "}," },
		],
	},
};

/** A long line scrolls inside; it does not widen the card. */
export const LongLine: Story = {
	args: {
		lines: [
			{ type: "same", text: "export default defineSchema({" },
			{
				type: "add",
				text: '  description: "A very long line that does not fit in the card and scrolls sideways instead of stretching it past its column",',
			},
			{ type: "same", text: "});" },
		],
	},
};
