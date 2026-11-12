import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	Button,
	Count,
	Inline,
	Ins,
	Progress,
	ProposalCard,
	RowTitle,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
} from "./index";

/**
 * A proposal in the assistant's conversation, as a frame: what it is and how much, its changes as rows of the shared table (the review page's
 * rows without their checks), and one foot that says where it stands and holds what can be done with all of it. The head carries no status.
 */
const meta = {
	title: "Monti/Proposal/ProposalCard",
	component: ProposalCard,
	args: { title: "제안" },
	decorators: [
		(Story) => (
			<Box width="assistant" padding={24} background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ProposalCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const kinds = (
	<Table container="none" aria-label="제안">
		<TableBody>
			<TableRow>
				<TableCell truncate>
					<RowTitle title="요약 채우기" />
				</TableCell>
				<TableCell align="end">
					<Count>2건</Count>
				</TableCell>
			</TableRow>
			<TableRow>
				<TableCell truncate>
					<RowTitle title="제목 다듬기" address="첫 번째 글" />
				</TableCell>
				<TableCell align="end">
					<Count>1건</Count>
				</TableCell>
			</TableRow>
		</TableBody>
	</Table>
);

const changes = (
	<Table container="none" aria-label="제안">
		<TableBody>
			<TableRow twoLine>
				<TableCell truncate>
					<Stack gap={4} minWidth={0}>
						<RowTitle title="둘째 글" address="/posts/second-post" />
						<Text as="div" variant="note" lines={2}>
							<Ins>둘째 글은 관리자 화면을 처음 여는 사람을 위한 안내입니다.</Ins>
						</Text>
					</Stack>
				</TableCell>
			</TableRow>
			<TableRow twoLine>
				<TableCell truncate>
					<Stack gap={4} minWidth={0}>
						<RowTitle title="셋째 글" address="/posts/third-post" />
						<Text as="div" variant="note" lines={2}>
							<Ins>셋째 글은 배포한 뒤에 확인할 것을 정리합니다.</Ins>
						</Text>
					</Stack>
				</TableCell>
			</TableRow>
		</TableBody>
	</Table>
);

const waiting = (count: number, review = false) => (
	<Inline gap={12} align="center" grow>
		{review ? (
			<Button variant="ghost" size="sm">
				검토
			</Button>
		) : null}
		<Inline gap={12} align="center" grow justify="end">
			<Button variant="ghost" size="sm">
				버리기
			</Button>
			<Button variant="primary" size="sm">
				{count}건 적용
			</Button>
		</Inline>
	</Inline>
);

/** Waiting, several kinds of change: one row a kind, and the way to the review page. */
export const Waiting: Story = {
	args: { summary: "2묶음 · 3건", footer: waiting(3, true), children: kinds },
};

/** Waiting, one kind: its changes themselves, each with what it puts in. Few enough to read here, so there is no review button. */
export const Changes: Story = {
	args: { summary: "2건", footer: waiting(2), children: changes },
};

/** Being applied: how far it has come. */
export const Applying: Story = {
	args: {
		summary: "2묶음 · 3건",
		children: kinds,
		footer: (
			<Inline gap={12} align="center" grow justify="end">
				<Text variant="note">적용 중</Text>
				<Count>2 / 3</Count>
				<Progress inline value={66} label="적용 중" />
			</Inline>
		),
	},
};

/** Applied: how many, how many could not be, and the way to undo them. */
export const Applied: Story = {
	args: {
		summary: "2묶음 · 3건",
		children: kinds,
		footer: (
			<Inline gap={12} align="center" grow>
				<Text variant="note" tone="success">
					✓ 2건 적용
				</Text>
				<Text variant="note" tone="danger">
					1건 못 함
				</Text>
				<Inline gap={12} align="center" grow justify="end">
					<Button variant="ghost" size="sm">
						되돌리기
					</Button>
				</Inline>
			</Inline>
		),
	},
};

/** Undone: the foot says so, and nothing is left to press. */
export const Undone: Story = {
	args: {
		summary: "2건",
		children: changes,
		footer: (
			<Text variant="note" tone="subtle">
				되돌림
			</Text>
		),
	},
};

/** Discarded: the card is faint. */
export const Discarded: Story = {
	args: {
		summary: "2건",
		muted: true,
		children: changes,
		footer: (
			<Text variant="note" tone="subtle">
				버림
			</Text>
		),
	},
};
