import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

const meta = {
	title: "Primitives/Label",
	component: Label,
	args: { children: "글 제목", size: "micro", tone: "subtle", hidden: false, required: false },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
	render: () => (
		<Stack gap={12}>
			{(["micro", "label", "caption", "body"] as const).map((size) => (
				<Stack key={size} gap={4}>
					<StoryCaption>size {size}</StoryCaption>
					<Label size={size}>글 제목</Label>
				</Stack>
			))}
		</Stack>
	),
};

export const Tones: Story = {
	render: () => (
		<Stack gap={12}>
			{(["subtle", "muted", "default"] as const).map((tone) => (
				<Stack key={tone} gap={4}>
					<StoryCaption>tone {tone}</StoryCaption>
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
					<StoryCaption>hidden {String(hidden)}</StoryCaption>
					<Label htmlFor={`hidden-${hidden}`} hidden={hidden}>
						글 제목
					</Label>
					<Input id={`hidden-${hidden}`} placeholder="글 제목" />
				</Stack>
			))}
		</Stack>
	),
};
