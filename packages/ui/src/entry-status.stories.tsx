import type { Meta, StoryObj } from "@storybook/react-vite";
import { EntryStatus, type EntryStatusKind } from "./entry-status";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * Where an entry stands: a 7px mark and the name, together, never the color alone. Published is a filled dot, editing a filled dot in the warning
 * color, draft an empty ring, archived a short bar, failed a red dot (a delivery that did not arrive).
 */
const meta = {
	title: "Controls/Status/EntryStatus",
	component: EntryStatus,
	args: { status: "published", children: "발행됨" },
} satisfies Meta<typeof EntryStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const STATUSES: [EntryStatusKind, string][] = [
	["published", "발행됨"],
	["editing", "수정 중"],
	["draft", "초안"],
	["archived", "보관됨"],
	["failed", "전송 실패"],
];

export const AllStatuses: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center" wrap>
			{STATUSES.map(([status, name]) => (
				<EntryStatus key={status} status={status}>
					{name}
				</EntryStatus>
			))}
		</Stack>
	),
};

/** Without a name it is the mark alone, decorative: a language tab says the status in its own words. */
export const MarkOnly: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			{STATUSES.map(([status]) => (
				<EntryStatus key={status} status={status} />
			))}
		</Stack>
	),
};

/** As a list shows it: the status in a column of its own, beside the title. */
export const InAList: Story = {
	render: () => (
		<Stack gap={8}>
			{[
				["published", "발행됨", "처음 쓰는 블로그 글"],
				["draft", "초안", "여름 여행 기록"],
				["editing", "수정 중", "이사 후기"],
				["archived", "보관됨", "지난해 소식"],
			].map(([status, name, title]) => (
				<Stack key={title} direction="row" gap={16} align="center">
					<span className="w-20">
						<EntryStatus status={status as EntryStatusKind}>{name}</EntryStatus>
					</span>
					<Text>{title}</Text>
				</Stack>
			))}
		</Stack>
	),
};
