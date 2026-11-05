import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorCompareScreen } from "./editor-compare";
import { EditorNotionScreen } from "./editor-notion";
import { EditorProposalScreen } from "./editor-proposal";
import { EditorTranslateScreen } from "./editor-translate";
import { ImageInsertScreen } from "./image-insert";
import { LinkCardScreen } from "./link-card";
import { TemplateEditorScreen } from "./template-editor";
import { TranslatePairedScreen } from "./translate-paired";

/** The editor's reference screens, made only of design-system parts. */
const meta = {
	title: "Screens/Reference/Editor",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditorNotion: Story = { render: () => <EditorNotionScreen /> };
export const EditorProposal: Story = { render: () => <EditorProposalScreen /> };
export const EditorCompare: Story = { render: () => <EditorCompareScreen /> };
export const EditorTranslate: Story = { render: () => <EditorTranslateScreen /> };
export const TranslatePaired: Story = { render: () => <TranslatePairedScreen /> };
export const TemplateEditor: Story = { render: () => <TemplateEditorScreen /> };
export const ImageInsert: Story = { render: () => <ImageInsertScreen /> };

/** The link card, one field as Notion's: just opened, it lists the entries changed last. */
export const LinkCardOpen: Story = { render: () => <LinkCardScreen state="open" /> };
/** Words typed: the site's entries that match. Picking one links to the entry itself. */
export const LinkCardSearch: Story = { render: () => <LinkCardScreen state="search" /> };
/** An address typed: one row, and Enter links out. */
export const LinkCardAddress: Story = { render: () => <LinkCardScreen state="address" /> };
/** Opened on words that link to an entry: that entry, and the way to take the link off. */
export const LinkCardLinked: Story = { render: () => <LinkCardScreen state="linked" /> };
