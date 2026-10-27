import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { ToolCallLine } from "./tool-call-line";

const details = [
	{ label: "Input", value: JSON.stringify({ collection: "post", status: "draft" }, null, 2) },
	{ label: "Result", value: JSON.stringify({ items: [{ id: "a" }, { id: "b" }], total: 2 }, null, 2) },
];

const meta = {
	title: "Chat/Tool call line",
	component: ToolCallLine,
	args: { name: "entries.list", status: "done", statusLabel: "Done", details },
	argTypes: { status: { control: "inline-radio", options: ["running", "done", "failed"] } },
} satisfies Meta<typeof ToolCallLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Where the call stands: running, done, failed. */
export const Statuses: Story = {
	render: () => (
		<Stack gap={4} maxWidth="panel">
			<ToolCallLine name="entries.list" status="running" statusLabel="Running" />
			<ToolCallLine name="entries.list" status="done" statusLabel="Done" details={details} />
			<ToolCallLine
				name="entries.get"
				status="failed"
				statusLabel="Failed"
				details={[{ label: "Result", value: '{ "error": { "code": "not_found", "message": "No such entry" } }' }]}
			/>
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
		statusLabel: "Failed",
		defaultOpen: true,
		details: [{ label: "Result", value: "The operation failed." }],
	},
};
