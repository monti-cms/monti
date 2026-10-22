import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Text } from "./text";
import { TextLink } from "./text-link";

const meta = {
	title: "Controls/TextLink",
	component: TextLink,
	args: { children: "여름 여행 기록", href: "#top", underline: "always", tone: "default", size: "inherit" },
} satisfies Meta<typeof TextLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Underline: Story = {
	render: () => (
		<Stack gap="condensed" align="start">
			{(["always", "hover", "none"] as const).map((underline) => (
				<TextLink key={underline} href="#top" underline={underline}>
					underline {underline}
				</TextLink>
			))}
		</Stack>
	),
};

export const Tone: Story = {
	render: () => (
		<Stack gap="condensed" align="start">
			{(["default", "muted", "accent"] as const).map((tone) => (
				<TextLink key={tone} href="#top" tone={tone}>
					tone {tone}
				</TextLink>
			))}
		</Stack>
	),
};

export const Size: Story = {
	render: () => (
		<Stack gap="condensed" align="start">
			{(["inherit", "caption", "label", "body"] as const).map((size) => (
				<TextLink key={size} href="#top" size={size}>
					size {size}
				</TextLink>
			))}
		</Stack>
	),
};

export const Mono: Story = {
	render: () => (
		<Stack gap="condensed" align="start">
			{[false, true].map((mono) => (
				<TextLink key={String(mono)} href="#top" mono={mono}>
					mono {String(mono)}
				</TextLink>
			))}
		</Stack>
	),
};

/** As a button through `render`, for an action that reads as text. */
export const AsButton: Story = {
	render: () => (
		<Text>
			변경 사항이 있어요.{" "}
			<TextLink render={<button type="button" />} underline="hover">
				되돌리기
			</TextLink>
		</Text>
	),
};
