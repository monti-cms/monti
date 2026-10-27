import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/Label",
	component: Label,
	args: { children: "글 제목", size: "label", tone: "default", hidden: false },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
	render: () => (
		<Stack gap={12}>
			{(["label", "caption", "body"] as const).map((size) => (
				<Stack key={size} gap={4}>
					<Text variant="label" tone="muted">
						size {size}
					</Text>
					<Label size={size}>글 제목</Label>
				</Stack>
			))}
		</Stack>
	),
};

export const Tones: Story = {
	render: () => (
		<Stack gap={12}>
			{(["default", "muted"] as const).map((tone) => (
				<Stack key={tone} gap={4}>
					<Text variant="label" tone="muted">
						tone {tone}
					</Text>
					<Label tone={tone}>글 제목</Label>
				</Stack>
			))}
		</Stack>
	),
};

/** `hidden` keeps the label for screen readers only; the input is still named. */
export const Hidden: Story = {
	render: () => (
		<Stack gap={12}>
			{[false, true].map((hidden) => (
				<Stack key={String(hidden)} gap={4}>
					<Text variant="label" tone="muted">
						hidden {String(hidden)}
					</Text>
					<Label htmlFor={`hidden-${hidden}`} hidden={hidden}>
						글 제목
					</Label>
					<Input id={`hidden-${hidden}`} placeholder="글 제목" />
				</Stack>
			))}
		</Stack>
	),
};
