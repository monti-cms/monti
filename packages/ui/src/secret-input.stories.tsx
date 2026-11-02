import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SavedValue, SecretInput } from "./secret-input";
import { Stack } from "./stack";

/** A key typed hidden, with an eye that shows what was just typed; a saved key is shown only by its last characters, with 바꾸기 to type a new one. */
const meta = {
	title: "Controls/Field/SecretInput",
	component: SecretInput,
	args: { showLabel: "키 보기", hideLabel: "키 가리기", placeholder: "sk-ant-…" },
	decorators: [
		(Story) => (
			<div style={{ width: 372 }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SecretInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Typed: Story = { args: { defaultValue: "sk-ant-api03-Qx7mR2vLp9TzW4nB8cKd" } };

/** The service refused it: the line turns danger (the message under it is a `FormFieldError`). */
export const Invalid: Story = { args: { defaultValue: "sk-ant-api03-Qx7mR2vLp9TzW4nB8cKd", "aria-invalid": true } };

/** In the edit dialog: 바꾸기 opens the input in place, 그대로 goes back. */
export const SavedThenReplaced: Story = {
	render: (args) => {
		const [open, setOpen] = useState(false);
		return (
			<Stack gap={16}>
				{open ? (
					<SecretInput {...args} placeholder="" autoFocus keep={{ label: "그대로", onClick: () => setOpen(false) }} />
				) : (
					<SavedValue action={{ label: "바꾸기", onClick: () => setOpen(true) }}>··· a1b2</SavedValue>
				)}
			</Stack>
		);
	},
};
