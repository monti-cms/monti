import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { Stack } from "./stack";

const meta = {
	title: "Controls/Checkbox",
	component: Checkbox,
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Stack direction="row" gap="condensed" align="center">
			<Checkbox id="pg" {...args} />
			<Label htmlFor="pg">댓글 허용</Label>
		</Stack>
	),
};

/** Unchecked, checked, indeterminate, each plain, disabled and invalid. */
export const States: Story = {
	render: () => (
		<Stack gap="normal">
			{[
				{ name: "unchecked", props: {} },
				{ name: "checked", props: { defaultChecked: true } },
				{ name: "indeterminate", props: { indeterminate: true } },
				{ name: "disabled", props: { disabled: true } },
				{ name: "disabled · checked", props: { disabled: true, defaultChecked: true } },
				{ name: "invalid", props: { "aria-invalid": true } },
				{ name: "invalid · checked", props: { "aria-invalid": true, defaultChecked: true } },
			].map(({ name, props }) => (
				<Stack key={name} direction="row" gap="condensed" align="center">
					<Checkbox id={name} {...props} />
					<Label htmlFor={name}>{name}</Label>
				</Stack>
			))}
		</Stack>
	),
};
