import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Spinner } from "./spinner";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Feedback/Spinner",
	component: Spinner,
	args: {},
} satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="center">
			<Spinner className="size-3" />
			<Spinner />
			<Spinner className="size-6" />
			<Spinner className="size-8" />
		</Stack>
	),
};

export const InButton: Story = {
	render: () => (
		<Stack direction="row" gap="condensed" align="center">
			<Button disabled>
				<Spinner />
				저장 중
			</Button>
			<Button variant="outline" disabled>
				<Spinner />
				불러오는 중
			</Button>
		</Stack>
	),
};

export const WithText: Story = {
	render: () => (
		<Stack direction="row" gap="condensed" align="center">
			<Spinner />
			<Text tone="muted">글을 불러오는 중이에요</Text>
		</Stack>
	),
};
