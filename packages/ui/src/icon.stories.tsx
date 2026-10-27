import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Icon } from "./icon";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

const meta = {
	title: "Primitives/Icon",
	component: Icon,
	args: { icon: FileText, size: "md", tone: "inherit" },
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const SIZES = ["xs", "sm", "md", "lg"] as const;
const TONES = ["inherit", "muted", "subtle", "danger", "warning", "success"] as const;

export const Sizes: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="end">
			{SIZES.map((size) => (
				<Stack key={size} gap={4} align="center">
					<Icon icon={FileText} size={size} />
					<StoryCaption>size {size}</StoryCaption>
				</Stack>
			))}
		</Stack>
	),
};

export const Tones: Story = {
	render: () => (
		<Stack direction="row" gap={24} wrap align="end">
			{TONES.map((tone) => (
				<Stack key={tone} gap={4} align="center">
					<Icon icon={AlertTriangle} tone={tone} />
					<StoryCaption>tone {tone}</StoryCaption>
				</Stack>
			))}
		</Stack>
	),
};

export const Spin: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="end">
			{[false, true].map((spin) => (
				<Stack key={String(spin)} gap={4} align="center">
					<Icon icon={Loader2} spin={spin} />
					<StoryCaption>spin {String(spin)}</StoryCaption>
				</Stack>
			))}
		</Stack>
	),
};

/** With a `label` the icon is announced as an image; without one it is decorative. */
export const Label: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="end">
			<Stack gap={4} align="center">
				<Icon icon={CheckCircle2} tone="success" label="발행됨" />
				<StoryCaption>label 있음</StoryCaption>
			</Stack>
			<Stack gap={4} align="center">
				<Icon icon={CheckCircle2} tone="success" />
				<StoryCaption>label 없음</StoryCaption>
			</Stack>
		</Stack>
	),
};
