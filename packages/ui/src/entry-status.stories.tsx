import type { Meta, StoryObj } from "@storybook/react-vite";
import { EntryStatus, Inline, Stack, Table, TableBody, TableCell, TableRow, Text } from "./index";

/** Where an entry or a delivery stands: a 7px mark and the name. The meaning is the shape and the name together, never the color alone. */
const meta = {
	title: "Controls/Status/EntryStatus",
	component: EntryStatus,
	tags: ["visual"],
	args: { status: "published" },
} satisfies Meta<typeof EntryStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each status: published (filled dot), editing (warning dot), draft (ring), archived (bar), failed (red dot). */
export const All: Story = {
	render: () => (
		<Stack gap={8}>
			<EntryStatus status="published">발행됨</EntryStatus>
			<EntryStatus status="editing">수정 중</EntryStatus>
			<EntryStatus status="draft">초안</EntryStatus>
			<EntryStatus status="archived">보관</EntryStatus>
			<EntryStatus status="failed">실패</EntryStatus>
		</Stack>
	),
};

/** `quiet`: the usual case in a column of statuses, so the others stand out. */
export const Quiet: Story = { args: { status: "published", quiet: true, children: "발행됨" } };

/** The mark alone (a language's tab); say the status in words nearby. */
export const MarkOnly: Story = { args: { status: "editing" } };

/** In a table cell dragged to its narrowest (60px) the name ends in "…" and the mark stays; the cell's `title` says it whole. */
export const NarrowCell: Story = {
	render: () => (
		<Table layout="fixed" columns={[60, undefined]}>
			<TableBody>
				<TableRow>
					<TableCell truncate title="수정 중">
						<EntryStatus status="editing">수정 중</EntryStatus>
					</TableCell>
					<TableCell>발행 후 고친 글</TableCell>
				</TableRow>
				<TableRow>
					<TableCell truncate title="발행됨">
						<EntryStatus status="published" quiet>
							발행됨
						</EntryStatus>
					</TableCell>
					<TableCell>첫 번째 글</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	),
};

/** In a row of things short of room (an editor's head) it stays whole: what stands beside it gives way. */
export const BesideLongText: Story = {
	render: () => (
		<Stack width="panel">
			<Inline gap={12}>
				<Text mono variant="meta" tone="faint" truncate>
					/posts/a-very-long-address-that-does-not-fit-in-the-head-of-the-editor
				</Text>
				<EntryStatus status="published">발행됨</EntryStatus>
			</Inline>
		</Stack>
	),
};
