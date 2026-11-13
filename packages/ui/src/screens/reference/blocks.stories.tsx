import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	CalloutKindsScreen,
	CalloutScreen,
	ChartTableScreen,
	ChartTextScreen,
	CodeExplorerScreen,
	CollapsibleScreen,
	ColorScreen,
	ColumnsScreen,
	HandleScreen,
	MathScreen,
	MermaidScreen,
	TabsScreen,
	TooltipScreen,
} from "./blocks";

/** The blocks of `@monti-cms/blocks` in the editor (doc 18), made only of design-system parts: each block's own tool row and settings. */
const meta = {
	title: "Screens/Reference/Blocks",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The caret in a callout: its row's kind button open on the five kinds, ✓ on the one it is. */
/** The five kinds of callout, each in its accent. */
export const CalloutKinds: Story = { render: () => <CalloutKindsScreen /> };
export const CalloutKind: Story = { render: () => <CalloutScreen /> };
/** Tabs: the picked tab's name typed where it reads, its row (first tab, remove), the + at the end of the tabs. */
export const Tabs: Story = { render: () => <TabsScreen /> };
/** Columns: the line between them being dragged, the + band at the right edge, the row's widths and "even". */
export const ColumnsDrag: Story = { render: () => <ColumnsScreen state="drag" /> };
/** A column's grip on its top edge with its menu, as a table's column. */
export const ColumnsMenu: Story = { render: () => <ColumnsScreen state="menu" /> };
/** A collapsible open in the editor, its row's "open at first" pressed. */
export const Collapsible: Story = { render: () => <CollapsibleScreen /> };
/** A code explorer: the row's "first file" menu open. */
export const CodeExplorerFirst: Story = { render: () => <CodeExplorerScreen state="first" /> };
/** A code explorer at rest: the current file's remove button, "+ 파일" · "+ 폴더". */
export const CodeExplorer: Story = { render: () => <CodeExplorerScreen state="rest" /> };
/** A formula picked: the drawing on top and its source under it, in the block. */
export const Formula: Story = { render: () => <MathScreen /> };
/** A diagram whose source does not read: the line's problem under the field. */
export const Mermaid: Story = { render: () => <MermaidScreen /> };
/** The chart's own text with its drawing (option A, the old block). */
export const ChartText: Story = { render: () => <ChartTextScreen /> };
/** The chart's text with a line that does not read. */
export const ChartTextError: Story = { render: () => <ChartTextScreen error /> };
/** The chart's data as a table under the drawing (option B). */
export const ChartTable: Story = { render: () => <ChartTableScreen /> };
/** The format bar's ⋯ › "글자 색": text colours and backgrounds, ✓ on the current (approved 2026-11-14). */
export const Color: Story = { render: () => <ColorScreen /> };
/** The tooltip's card: one field, no "remove" (clearing the formats takes it off). */
export const Tooltip: Story = { render: () => <TooltipScreen /> };
/** The block handle's three looks to choose from, each pointed at, with its menu open and while dragging. */
export const Handle: Story = { render: () => <HandleScreen /> };
