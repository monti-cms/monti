import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropLine, HeldBlock } from "./index";

/** A block in hand while it is dragged, and the line where it would land. */
const meta = {
	title: "Monti/EditorTools/HeldBlock",
	component: HeldBlock,
	parameters: { layout: "padded" },
	args: { html: "<h2>서론</h2>" },
} satisfies Meta<typeof HeldBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A heading in hand. */
export const Heading: Story = {
	render: (args) => (
		<div className="max-w-monti-reading">
			<HeldBlock {...args} />
		</div>
	),
};

/** A list item in hand keeps its list's bullet; the drop line is under the item it lands after. */
export const ListItemAndLine: Story = {
	args: { html: "<ul><li>두 번째 요점</li></ul>" },
	render: (args) => (
		<div className="flex max-w-monti-reading flex-col gap-monti-24">
			<HeldBlock {...args} />
			<DropLine />
		</div>
	),
};
