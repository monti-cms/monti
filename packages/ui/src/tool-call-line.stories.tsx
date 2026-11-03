import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, ToolCallLine } from "./index";

const DETAILS = [
	{ label: "입력", value: '{ "collection": "posts", "filter": { "excerpt": null } }' },
	{ label: "결과", value: '[{ "slug": "autumn-trail" }, { "slug": "hello-monti" }]' },
];

/**
 * One call the assistant made, as a mono line: a spinner and darker words while it runs, ✓ when done, a red × and red words when it failed or
 * stopped there. With details the line opens to the input and the result (the caret shows while pointed at, focused or open).
 */
const meta = {
	title: "Monti/Assistant/ToolCallLine",
	component: ToolCallLine,
	args: { status: "done", statusLabel: "완료", children: "글 목록 읽음 · 게시글 148편" },
	decorators: [
		(Story) => (
			<Box width="assistant" padding={24} background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ToolCallLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const Running: Story = { args: { status: "running", statusLabel: "하는 중", children: "글 목록 읽는 중" } };

/** Failed, or stopped there when the connection dropped. */
export const Failed: Story = { args: { status: "failed", statusLabel: "실패", children: "글 읽기 · 여기서 멈춤" } };

/** With details: press to open the input and the result. */
export const WithDetails: Story = { args: { details: DETAILS } };

export const Open: Story = { args: { details: DETAILS, defaultOpen: true } };
