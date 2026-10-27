import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { ToolCallLine } from "./tool-call-line";

const details = [
	{ label: "Input", value: JSON.stringify({ collection: "post", status: "draft" }, null, 2) },
	{ label: "Result", value: JSON.stringify({ items: [{ id: "a" }, { id: "b" }], total: 2 }, null, 2) },
];

/** One call the assistant made, as a mono line: a mark for where it stands and what was done. It opens to the input and the result. */
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
				details={[{ label: "Result", value: '{ "error": { "code": "not_found", "message": "No such entry" } }' }]}
			>
				글 열기 실패 · 없는 글
			</ToolCallLine>
		</Stack>
	),
};

/** Opened: the input and the result, as text. */
export const Open: Story = { args: { defaultOpen: true } };

/** Without details the line is not a button. */
export const NotExpandable: Story = { args: { details: undefined } };

export const OpenFailed: Story = {
	args: {
		status: "failed",
		statusLabel: "실패",
		defaultOpen: true,
		children: "글 열기 실패 · 없는 글",
		details: [{ label: "Result", value: "The operation failed." }],
	},
};
