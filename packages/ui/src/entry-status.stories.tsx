import type { Meta, StoryObj } from "@storybook/react-vite";
import { EntryStatus, Stack } from "./index";

/** Where an entry or a delivery stands: a 7px mark and the name. The meaning is the shape and the name together, never the color alone. */
const meta = {
	title: "Controls/Status/EntryStatus",
	component: EntryStatus,
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
