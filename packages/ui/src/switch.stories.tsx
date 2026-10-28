import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";
import { Stack } from "./stack";
import { Switch } from "./switch";

const meta = {
	title: "Controls/Choice/Switch",
	component: Switch,
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Stack direction="row" gap={8} align="center">
			<Switch id="pg" {...args} />
			<Label htmlFor="pg" size="body" tone="default">
				공개
			</Label>
		</Stack>
	),
};

/** Off, on, AI-turned-on (blue) and disabled. Off is a `border-default` track with a page-colored knob, as the design system draws it. */
export const States: Story = {
	render: () => (
		<Stack gap={12}>
			{[
				{ name: "off", props: {} },
				{ name: "on", props: { defaultChecked: true } },
				{ name: "proposal · on", props: { defaultChecked: true, proposal: true } },
				{ name: "disabled", props: { disabled: true } },
				{ name: "disabled · on", props: { disabled: true, defaultChecked: true } },
			].map(({ name, props }) => (
				<Stack key={name} direction="row" gap={8} align="center">
					<Switch id={name} {...props} />
					<Label htmlFor={name} size="body" tone="default">
						{name}
					</Label>
				</Stack>
			))}
		</Stack>
	),
};
