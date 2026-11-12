import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	ConditionalCompareScreen,
	ConditionalFieldSheetScreen,
	ConditionalFieldsScreen,
	ConditionalPanelScreen,
	ConditionalProposalScreen,
	ConditionalReviewScreen,
} from "./conditional";

/** Doc 19, conditional fields: the states for the owner's look before the screens are built. */
const meta = {
	title: "Screens/Reference/Conditional",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const FieldSheet: Story = { render: () => <ConditionalFieldSheetScreen /> };
export const FieldsList: Story = { render: () => <ConditionalFieldsScreen /> };
export const PanelBefore: Story = { render: () => <ConditionalPanelScreen /> };
export const PanelAfter: Story = { render: () => <ConditionalPanelScreen changed /> };
export const Review: Story = { render: () => <ConditionalReviewScreen /> };
export const Proposal: Story = { render: () => <ConditionalProposalScreen /> };
export const Comparison: Story = { render: () => <ConditionalCompareScreen /> };
