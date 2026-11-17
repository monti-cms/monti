import type { Meta, StoryObj } from "@storybook/react-vite";
import { Caret, Collapsible, CollapsibleContent, CollapsibleTrigger, Text } from "./index";

/** What opens and closes a part in place; the trigger ends with a `Caret`. A disabled trigger dims to .45. */
const meta = {
	title: "Patterns/Frame/Collapsible",
	component: Collapsible,
} satisfies Meta<typeof Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
	render: () => (
		<Collapsible defaultOpen>
			<CollapsibleTrigger>
				고급 <Caret />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<Text variant="note">목록에서 숨기기, 기본값</Text>
			</CollapsibleContent>
		</Collapsible>
	),
};

export const Closed: Story = {
	render: () => (
		<Collapsible>
			<CollapsibleTrigger>
				고급 <Caret />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<Text variant="note">목록에서 숨기기, 기본값</Text>
			</CollapsibleContent>
		</Collapsible>
	),
};

export const Disabled: Story = {
	render: () => (
		<Collapsible>
			<CollapsibleTrigger disabled>
				고급 <Caret />
			</CollapsibleTrigger>
		</Collapsible>
	),
};
