import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Ins, ProposalActions, ProposalCard, ProposalItem, ProposalResult, ProposalRow } from "./index";

const noop = () => {};

/**
 * A proposal in the conversation: the head with how much it changes and where it stands, a line per group of changes (or a file per new text),
 * and the foot: waiting (details · discard · apply), applying, applied (✓ count · failed · time · undo all), or discarded (faint).
 */
const meta = {
	title: "Monti/Proposal/ProposalCard",
	component: ProposalCard,
	args: { title: "제안" },
	decorators: [
		(Story) => (
			<Box width="assistant" padding={24}>
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ProposalCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = (
	<>
		<ProposalRow name="다듬기" detail="발행 후 고친 글" count="3곳" />
		<ProposalRow name="요약 채우기" detail="요약이 빈 글" count="11편" />
		<ProposalRow name="폴더 옮기기" detail="폴더 없는 글" count="4편" />
		<ProposalRow name="태그 정리" detail="비슷한 태그" count="1건" />
	</>
);

export const Waiting: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="4묶음 · 19건"
			status="검토 대기"
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel="상세 보기"
					onReview={noop}
					discardLabel="버리기"
					onDiscard={noop}
					applyLabel="19건 적용"
					onApply={noop}
				/>
			}
		>
			{ROWS}
		</ProposalCard>
	),
};

/** Applying: the head counts and the pill works; nothing can be pressed. */
export const Applying: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="4묶음 · 19건"
			status="적용 중 9 / 17"
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel="상세 보기"
					onReview={noop}
					discardLabel="버리기"
					onDiscard={noop}
					applyLabel="19건 적용"
					onApply={noop}
					busy
				/>
			}
		>
			{ROWS}
		</ProposalCard>
	),
};

/** Applied with one failure: the result foot, and under it the item that could not be applied and why. */
export const Applied: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="4묶음 · 17건"
			status="적용됨"
			statusTone="success"
			footer={
				<ProposalResult
					appliedLabel="✓ 16건 적용"
					failedLabel="1건 못 함"
					time="10:52"
					undoLabel="모두 되돌리기"
					onUndo={noop}
				/>
			}
			after={<ProposalRow name="못 함" detail="겨울 준비 · 그 사이 휴지통으로 감" tone="danger" />}
		>
			{ROWS}
		</ProposalCard>
	),
};

/** Undone: the status says when. */
export const Undone: Story = {
	render: () => (
		<ProposalCard title="제안" summary="4묶음 · 19건" status="되돌림 · 10:44" statusTone="subtle">
			{ROWS}
		</ProposalCard>
	),
};

/** Discarded: the card is faint. */
export const Discarded: Story = {
	render: () => (
		<ProposalCard title="제안" summary="4묶음 · 19건" status="버림" statusTone="subtle" muted>
			{ROWS}
		</ProposalCard>
	),
};

/** New text per file (alt texts): three files at most, then a faint "외 97개" line and "상세 보기". */
export const Files: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="대체 텍스트 · 100개"
			status="검토 대기"
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel="상세 보기"
					onReview={noop}
					discardLabel="버리기"
					onDiscard={noop}
					applyLabel="100개 적용"
					onApply={noop}
				/>
			}
		>
			<ProposalItem title="autumn-trail.jpg">
				<Ins>단풍이 든 산길을 걷는 두 사람</Ins>
			</ProposalItem>
			<ProposalItem title="harbor-night.png">
				<Ins>불이 켜진 밤 항구와 정박한 배들</Ins>
			</ProposalItem>
			<ProposalItem title="desk-setup.webp">
				<Ins>노트북과 커피잔이 놓인 나무 책상</Ins>
			</ProposalItem>
			<ProposalRow detail="외 97개" />
		</ProposalCard>
	),
};

/** Three files or fewer: no "상세 보기". */
export const FewFiles: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="대체 텍스트 · 2개"
			status="검토 대기"
			statusTone="warning"
			footer={<ProposalActions discardLabel="버리기" onDiscard={noop} applyLabel="2개 적용" onApply={noop} />}
		>
			<ProposalItem title="autumn-trail.jpg">
				<Ins>단풍이 든 산길을 걷는 두 사람</Ins>
			</ProposalItem>
			<ProposalItem title="harbor-night.png">
				<Ins>불이 켜진 밤 항구와 정박한 배들</Ins>
			</ProposalItem>
		</ProposalCard>
	),
};
