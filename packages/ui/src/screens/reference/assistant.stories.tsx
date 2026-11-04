import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantScreen } from "./assistant";
import { AssistantFirstScreen } from "./assistant-first";
import { AssistantPanelScreen } from "./assistant-panel";
import { CollectionBasicsScreen } from "./collection-basics";
import { CollectionEditorScreen } from "./collection-editor";
import { ProposalReviewScreen } from "./proposal-review";
import { ProposalReviewSideScreen } from "./proposal-review-side";

// The design reference screens of the assistant and the collection settings, drawn with the design system's parts only.
const meta = { title: "Screens/Reference/Assistant", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Assistant: Story = { render: () => <AssistantScreen /> };
export const AssistantFirst: Story = { render: () => <AssistantFirstScreen /> };
export const AssistantPanel: Story = { render: () => <AssistantPanelScreen /> };
export const ProposalReview: Story = { render: () => <ProposalReviewScreen /> };
export const ProposalReviewSide: Story = { render: () => <ProposalReviewSideScreen /> };
export const CollectionBasics: Story = { render: () => <CollectionBasicsScreen /> };
export const CollectionEditor: Story = { render: () => <CollectionEditorScreen /> };
