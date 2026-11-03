import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthPage } from "./auth-page";
import { Button } from "./button";
import { Heading, Text } from "./text";

const meta = {
	title: "Patterns/AuthPage",
	component: AuthPage,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		title: (
			<Heading as="h1" variant="page">
				example.dev
			</Heading>
		),
		footer: (
			<Text as="p" variant="micro" tone="faint" align="center">
				Monti 0.2
			</Text>
		),
		children: (
			<Button variant="primary" width="full">
				GitHub로 로그인
			</Button>
		),
	},
};
