import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";
import { Stack } from "./stack";
import { Switch } from "./switch";

const meta = {
	title: "Controls/Switch",
	component: Switch,
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Stack direction="row" gap={8} align="center">
			<Switch id="pg" {...args} />
			<Label htmlFor="pg">공개</Label>
		</Stack>
	),
};

/** Both sizes, off and on, plus disabled and invalid. */
export const States: Story = {
	render: () => (
		<Stack gap={12}>
			{(["default", "sm"] as const).map((size) =>
				[
					{ name: "off", props: {} },
					{ name: "on", props: { defaultChecked: true } },
					{ name: "disabled", props: { disabled: true } },
					{ name: "disabled · on", props: { disabled: true, defaultChecked: true } },
					{ name: "invalid", props: { "aria-invalid": true } },
				].map(({ name, props }) => (
					<Stack key={`${size}-${name}`} direction="row" gap={8} align="center">
						<Switch id={`${size}-${name}`} size={size} {...props} />
						<Label htmlFor={`${size}-${name}`}>
							{size} · {name}
						</Label>
					</Stack>
				)),
			)}
		</Stack>
	),
};
