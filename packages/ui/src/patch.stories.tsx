import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Patch, type PatchLine } from "./index";

const LINES: PatchLine[] = [
	{ type: "same", text: "  posts: collection({" },
	{ type: "same", text: '    label: "글",' },
	{ type: "remove", text: "    summary: text()," },
	{ type: "add", text: "    excerpt: text({ max: 160 })," },
	{ type: "add", text: "    cover: image()," },
	{ type: "same", text: "  })," },
];

/** What changes in one file: the file name and the counts of added (green) and removed (red) lines, then the lines; the lines around are dimmed. */
const meta = {
	title: "Monti/Change/Patch",
	component: Patch,
	args: { file: "monti.schema.ts", lines: LINES },
	decorators: [
		(Story) => (
			<Box width="sheet">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof Patch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One text button at the end of the head. */
export const WithAction: Story = { args: { actionLabel: "복사", onAction: () => {} } };

/** Only added lines. */
export const AddOnly: Story = {
	args: {
		lines: [
			{ type: "same", text: "  locales: [" },
			{ type: "add", text: '    "ja",' },
			{ type: "same", text: "  ]," },
		],
	},
};
