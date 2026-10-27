import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Icon } from "./icon";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Feedback/Icon",
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
		<Stack direction="row" gap="spacious" align="end">
			{SIZES.map((size) => (
				<Stack key={size} gap="tight" align="center">
					<Icon icon={FileText} size={size} />
					<Text variant="label" tone="muted">
						size {size}
					</Text>
				</Stack>
			))}
		</Stack>
	),
};

export const Tones: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" wrap align="end">
			{TONES.map((tone) => (
				<Stack key={tone} gap="tight" align="center">
					<Icon icon={AlertTriangle} tone={tone} />
					<Text variant="label" tone="muted">
						tone {tone}
					</Text>
				</Stack>
			))}
		</Stack>
	),
};

export const Spin: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="end">
			{[false, true].map((spin) => (
				<Stack key={String(spin)} gap="tight" align="center">
					<Icon icon={Loader2} spin={spin} />
					<Text variant="label" tone="muted">
						spin {String(spin)}
					</Text>
				</Stack>
			))}
		</Stack>
	),
};

/** With a `label` the icon is announced as an image; without one it is decorative. */
export const Label: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="end">
			<Stack gap="tight" align="center">
				<Icon icon={CheckCircle2} tone="success" label="발행됨" />
				<Text variant="label" tone="muted">
					label 있음
				</Text>
			</Stack>
			<Stack gap="tight" align="center">
				<Icon icon={CheckCircle2} tone="success" />
				<Text variant="label" tone="muted">
					label 없음
				</Text>
			</Stack>
		</Stack>
	),
};
