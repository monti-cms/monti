import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { ToolCallLine } from "./tool-call-line";

const details = [
	{ label: "입력", value: JSON.stringify({ collection: "post", status: "draft" }, null, 2) },
	{ label: "결과", value: JSON.stringify({ items: [{ id: "a" }, { id: "b" }], total: 2 }, null, 2) },
];

/** One call the assistant made, as a mono line: a mark for where it stands and what was done. A line that opens ends in a caret; it shows the input and the result. */
const meta = {
	title: "Monti/Assistant/ToolCallLine",
	component: ToolCallLine,
	args: { status: "done", statusLabel: "완료", details, children: "글 목록 읽음 · 게시글 6편" },
	argTypes: { status: { control: "inline-radio", options: ["running", "done", "failed"] } },
} satisfies Meta<typeof ToolCallLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Where the call stands: running, done, failed. */
export const Statuses: Story = {
	render: () => (
		<Stack gap={4} maxWidth="panel">
			<ToolCallLine status="running" statusLabel="하는 중">
				글 목록 읽는 중
			</ToolCallLine>
			<ToolCallLine status="done" statusLabel="완료" details={details}>
				글 목록 읽음 · 게시글 6편
			</ToolCallLine>
			<ToolCallLine
				status="failed"
				statusLabel="실패"
				details={[{ label: "결과", value: '{ "error": { "code": "not_found", "message": "그런 글이 없어요" } }' }]}
			>
				글 열기 실패 · 없는 글
			</ToolCallLine>
		</Stack>
	),
};

/** Opened: the input and the result, as text. */
export const Open: Story = { args: { defaultOpen: true } };

/** Without details the line is not a button and has no caret. */
export const NotExpandable: Story = { args: { details: undefined } };

export const OpenFailed: Story = {
	args: {
		status: "failed",
		statusLabel: "실패",
		defaultOpen: true,
		children: "글 열기 실패 · 없는 글",
		details: [{ label: "결과", value: "작업이 실패했어요." }],
	},
};
