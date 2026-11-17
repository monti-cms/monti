import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatThread, Stack, Suggest } from "./index";

/**
 * A request to start from, in the assistant's empty panel: the ones the open screen offers (a spark), then the ones asked before (a clock). The
 * mark tells them apart: there are no group names. The rows stand at the foot of the `ChatThread`, just over the box to ask in.
 */
const meta = {
	title: "Monti/Assistant/Suggest",
	component: Suggest,
	decorators: [
		(Story) => (
			<Stack width="assistant" height="screen" background="tool">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Suggest>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The empty panel on the post list: the screen's requests, then the last two asked. */
export const EmptyPanel: Story = {
	args: { kind: "request", children: "" },
	render: () => (
		<ChatThread>
			<Stack gap={4}>
				<Suggest kind="request">요약이 비어 있는 글 찾아 줘</Suggest>
				<Suggest kind="request">한 달 넘게 안 고친 초안 찾아 줘</Suggest>
				<Suggest kind="recent">둘 다 요약 채워 줘</Suggest>
				<Suggest kind="recent">첫 번째 글 열어 줘</Suggest>
			</Stack>
		</ChatThread>
	),
};

/** Nothing asked yet on this site: the screen's requests alone. */
export const WithoutRecent: Story = {
	args: { kind: "request", children: "" },
	render: () => (
		<ChatThread>
			<Stack gap={4}>
				<Suggest kind="request">요약이 비어 있는 글 찾아 줘</Suggest>
				<Suggest kind="request">한 달 넘게 안 고친 초안 찾아 줘</Suggest>
			</Stack>
		</ChatThread>
	),
};
