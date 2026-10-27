import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiAction } from "./ai-action";
import { Stack } from "./stack";

/** "✦ 채우기" on an empty field, "↻ 다시" once it has a value, "쓰는 중…" with a spinner while it works: mono 11 in the proposal blue, no box. Usually on a `FormFieldLabel`. */
const meta = { title: "Monti/Proposal/AiAction", component: AiAction } satisfies Meta<typeof AiAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<AiAction />
			<AiAction filled />
			<AiAction loading />
			<AiAction disabled />
		</Stack>
	),
};

/** Writing: a spinner replaces ✦ or ↻, the label says "쓰는 중…", and it cannot be pressed again. It is not dimmed; only `disabled` dims. */
export const Loading: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<AiAction loading />
			<AiAction filled loading />
		</Stack>
	),
};
