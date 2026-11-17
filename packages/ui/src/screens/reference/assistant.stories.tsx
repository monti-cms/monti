import type { Meta, StoryObj } from "@storybook/react-vite";
import { CollectionBasicsScreen } from "./collection-basics";
import { CollectionEditorScreen } from "./collection-editor";

/**
 * The reference screens that stand behind the assistant in its flows. The assistant's own screens (its panel, a proposal's card and its review
 * page) have no reference drawing any more: since 2026-11-12 they are built from the parts the other screens use, and their look is the built
 * screen's stories, `Screens/Assistant` in the admin's Storybook.
 */
const meta = { title: "Screens/Reference/Assistant", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const CollectionBasics: Story = { render: () => <CollectionBasicsScreen /> };
export const CollectionEditor: Story = { render: () => <CollectionEditorScreen /> };
