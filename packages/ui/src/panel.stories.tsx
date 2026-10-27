import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "./panel";
import { Text } from "./text";

/** A resting surface with a hairline border, for a section of a screen: a list, a form group, a table. Floating things use the menu card instead. */
const meta = { title: "Layout/Panel", component: Panel, args: { padding: 16 } } satisfies Meta<typeof Panel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Panel {...args} className="max-w-sm">
			<Text>목록이나 표를 담는 단순한 면</Text>
		</Panel>
	),
};

/** The padding steps are the spacing scale's. */
export const Padding: Story = {
	render: () => (
		<div className="flex max-w-sm flex-col gap-monti-12">
			{([8, 12, 16, 24] as const).map((step) => (
				<Panel key={step} padding={step}>
					<Text variant="meta">padding {step}</Text>
				</Panel>
			))}
		</div>
	),
};
