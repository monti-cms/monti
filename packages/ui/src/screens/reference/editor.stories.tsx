import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorAssistScreen } from "./editor-assist";
import { EditorCompareScreen } from "./editor-compare";
import { EditorNotionScreen } from "./editor-notion";
import { EditorProposalScreen } from "./editor-proposal";
import { EditorTranslateScreen } from "./editor-translate";
import { FootnoteScreen } from "./footnote";
import { FormatClearScreen } from "./format-clear";
import { ImageInsertScreen } from "./image-insert";
import { LinkCardScreen } from "./link-card";
import { SignedOutEditorScreen, SignedOutListScreen } from "./signed-out";
import { TableToolsScreen } from "./table-tools";
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
/** A field's ✦ button while the quick task writes. */
export const EditorFilling: Story = { render: () => <EditorAssistScreen state="filling" /> };
/** The field filled: the value in the proposal blue until it is touched or saved, and "다시". */
export const EditorFilled: Story = { render: () => <EditorAssistScreen state="filled" /> };
/** The service said no: one line under the field. */
export const EditorFillFailed: Story = { render: () => <EditorAssistScreen state="fillFailed" /> };
/** "✦ 요청" on picked words: a card with only the box to write in. */
export const EditorRequest: Story = { render: () => <EditorAssistScreen state="request" /> };
/** A proposal whose paragraph was changed since: what it was made from, what it proposed, and making it again. */
export const EditorProposalStale: Story = { render: () => <EditorAssistScreen state="stale" /> };
/** A picture's words: "✦ 채우기" on the alt text's label row in its settings card, and at the end of its empty caption line. */
export const EditorImageFill: Story = { render: () => <EditorAssistScreen state="image" /> };
export const EditorCompare: Story = { render: () => <EditorCompareScreen /> };
export const EditorTranslate: Story = { render: () => <EditorTranslateScreen /> };
/** "✦ 번역" pressed: the button works until the translation is in. */
export const EditorTranslating: Story = { render: () => <EditorTranslateScreen stage="translating" /> };
/** The translation as proposals in each block (flow 3, step 3): blue letters, and the pill to step through and take them. */
export const EditorTranslateProposed: Story = { render: () => <EditorTranslateScreen stage="proposed" /> };
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

/** The session ended while writing: the banner over the bar, the save cell saying so. */
export const SignedOutEditor: Story = { render: () => <SignedOutEditorScreen /> };
/** The session ended on a list: the same banner, edge to edge over every screen. */
export const SignedOutList: Story = { render: () => <SignedOutListScreen /> };

/** Words picked with formats on part of them: "서식 지우기" at the end of the text formats. */
export const FormatClear: Story = { render: () => <FormatClearScreen state="formatted" /> };
/** After "서식 지우기": the words are plain, so the button is gone. */
export const FormatClearCleared: Story = { render: () => <FormatClearScreen state="cleared" /> };
/** T62: a light grid, quiet grips on the caret's column and row. */
export const TableGrid: Story = { render: () => <TableToolsScreen state="grid" /> };
/** The column grip pressed: the column picked, its menu open. */
export const TableGridMenu: Story = { render: () => <TableToolsScreen state="gridMenu" /> };
/** The pointer at the right edge: the strip that adds a column. */
export const TableGridAdd: Story = { render: () => <TableToolsScreen state="gridAdd" /> };
/** Words picked, "Note¹" on the format bar. */
export const FootnotePicked: Story = { render: () => <FootnoteScreen state="picked" /> };
/** The footnote put in: a numbered mark after the words, its text at the end with the caret, the others renumbered. */
export const FootnoteAdded: Story = { render: () => <FootnoteScreen state="added" /> };
