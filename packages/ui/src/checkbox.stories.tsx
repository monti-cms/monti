import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { Stack } from "./stack";

const meta = {
	title: "Controls/Choice/Checkbox",
	component: Checkbox,
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Stack direction="row" gap={8} align="center">
			<Checkbox id="pg" {...args} />
			<Label htmlFor="pg">댓글 허용</Label>
		</Stack>
	),
};

/** Off, on, mixed (some of a list picked), and the AI versions (the assistant chose); plain, disabled and invalid. */
export const States: Story = {
	render: () => (
		<Stack gap={12}>
			{[
				{ name: "unchecked", props: {} },
				{ name: "checked", props: { defaultChecked: true } },
				{ name: "mixed", props: { indeterminate: true } },
				{ name: "proposal · on", props: { defaultChecked: true, proposal: true } },
				{ name: "proposal · mixed", props: { indeterminate: true, proposal: true } },
				{ name: "disabled", props: { disabled: true } },
				{ name: "disabled · checked", props: { disabled: true, defaultChecked: true } },
				{ name: "invalid", props: { "aria-invalid": true } },
				{ name: "invalid · checked", props: { "aria-invalid": true, defaultChecked: true } },
			].map(({ name, props }) => (
				<Stack key={name} direction="row" gap={8} align="center">
					<Checkbox id={name} {...props} />
					<Label htmlFor={name}>{name}</Label>
				</Stack>
			))}
		</Stack>
	),
};
