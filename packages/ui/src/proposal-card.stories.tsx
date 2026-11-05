import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	Ins,
	ProposalActions,
	ProposalCard,
	ProposalEntry,
	ProposalItem,
	ProposalResult,
	ProposalRow,
} from "./index";

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
					reviewLabel="검토"
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
					reviewLabel="검토"
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

/** New text per file (alt texts): three files at most, then a faint "외 97개" line and "검토". */
export const Files: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="대체 텍스트 · 100개"
			status="검토 대기"
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel="검토"
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

/** Three files or fewer: no "검토". */
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

/** A field filled on each entry (flow 6): the entry's name, slug and field, then the new text alone, since the old value was empty. */
export const Entries: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="요약 채우기 · 글 2편"
			status="검토 대기"
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel="검토"
					onReview={noop}
					discardLabel="버리기"
					onDiscard={noop}
					applyLabel="적용"
					onApply={noop}
				/>
			}
		>
			<ProposalEntry
				name="발행 후 고친 글"
				slug="/edited-post"
				field="요약"
				after="예시 코드를 고친 뒤 다시 정리한 메모. 바뀐 코드와 이유를 한 번에 봅니다."
			/>
			<ProposalEntry
				name="쓰는 중인 글"
				slug="/draft-post"
				field="요약"
				after="글보다 도구를 고치는 데 시간을 더 쓰게 된 이유와 그 정리."
			/>
		</ProposalCard>
	),
};

/** Many entries: the first three, then a quiet "외 4편" line; "검토" opens them all. A value that was there is struck through over the new one. */
export const ManyEntries: Story = {
	render: () => (
		<ProposalCard
			title="제안"
			summary="요약 고치기 · 글 7편"
			status="검토 대기"
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel="검토"
					onReview={noop}
					discardLabel="버리기"
					onDiscard={noop}
					applyLabel="적용"
					onApply={noop}
				/>
			}
		>
			<ProposalEntry
				name="발행 후 고친 글"
				slug="/edited-post"
				field="요약"
				before="예시 코드를 고친 메모입니다."
				after="예시 코드를 고친 뒤 다시 정리한 메모."
			/>
			<ProposalEntry
				name="쓰는 중인 글"
				slug="/draft-post"
				field="요약"
				after="글보다 도구를 고치는 데 시간을 더 쓰게 된 이유와 그 정리."
			/>
			<ProposalEntry
				name="가을 산책"
				slug="/autumn-walk"
				field="요약"
				before="산길을 걸었다."
				after="단풍이 시작된 산길을 걸으며 본 것들."
			/>
			<ProposalRow detail="외 4편" />
		</ProposalCard>
	),
};
