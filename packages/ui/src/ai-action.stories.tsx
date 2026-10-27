import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiAction, Spark } from "./ai-action";
import { Stack } from "./stack";

/** "✦ 채우기" on an empty field, "↻ 다시" once it has a value: mono 11 in the proposal blue, no box. Usually on a `FormFieldLabel`. */
const meta = { title: "Controls/AiAction", component: AiAction } satisfies Meta<typeof AiAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<AiAction />
			<AiAction filled />
			<AiAction disabled />
			<Spark className="size-4 text-monti-proposal" />
		</Stack>
	),
};
