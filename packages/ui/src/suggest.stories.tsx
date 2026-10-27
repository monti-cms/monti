import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Suggest } from "./suggest";
import { Text } from "./text";

/** A request to start from, in the assistant's empty panel: a saved one (spark) or one asked before (clock). */
const meta = {
	title: "Chat/Suggest",
	component: Suggest,
	args: { kind: "request", children: "요약 써 줘" },
	decorators: [
		(Story) => (
			<div className="w-[340px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Suggest>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Under the group names of the empty panel. */
export const Groups: Story = {
	render: () => (
		<Stack gap={2}>
			<Text variant="micro" tone="subtle" className="px-monti-12 pb-monti-6">
				이 글에서
			</Text>
			<Suggest kind="request">요약 써 줘</Suggest>
			<Suggest kind="request">영어로 옮겨 줘</Suggest>
			<Text variant="micro" tone="subtle" className="px-monti-12 pt-monti-12 pb-monti-6">
				최근
			</Text>
			<Suggest kind="recent">첫 문단을 더 짧게 다듬어 줘</Suggest>
			<Suggest kind="recent">작년 글은 2024 폴더로 옮겨 줘</Suggest>
		</Stack>
	),
};
