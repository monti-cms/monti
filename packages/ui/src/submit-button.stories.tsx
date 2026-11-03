import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { SubmitButton } from "./submit-button";

/** A button that sends its form by a plain post: press it and it turns `loading` with its pending words until the next page comes. */
const meta = {
	title: "Controls/Button/SubmitButton",
	component: SubmitButton,
	args: { children: "로그인", pendingLabel: "로그인 중…", variant: "primary", width: "full" },
	render: (args) => (
		// The story stays on its page: the post is stopped, so the pending state is what is left to see.
		<form onSubmit={(event) => event.preventDefault()}>
			<SubmitButton {...args} />
		</form>
	),
} satisfies Meta<typeof SubmitButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

/** Pressed: the spinner, the pending words, and no second press. */
export const Sending: Story = {
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		await userEvent.click(button);
		await expect(button).toHaveAttribute("aria-busy", "true");
	},
};
