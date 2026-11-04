import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorBox } from "./index";

/** Why something could not be shown, in its place: the message as it is, mono, in the danger ink on the danger ground. Line breaks are kept. */
const meta = {
	title: "Controls/Status/ErrorBox",
	component: ErrorBox,
} satisfies Meta<typeof ErrorBox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Message: Story = {
	args: { children: "Parse error on line 3:\ngraph TD; A-->\n------------^\nExpecting 'NODE_STRING', got 'EOF'" },
};
