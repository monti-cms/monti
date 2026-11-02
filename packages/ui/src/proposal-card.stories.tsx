import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProposalActions, ProposalCard, ProposalItem, ProposalResult, ProposalRow } from "./proposal-card";
import { Ins } from "./proposal-marks";

/**
 * A proposal in the conversation: what it is and how much, where it stands, one row per group of changes, and the foot with what can be done. Once
 * applied the foot says how it went, with the time and a way back; what could not be applied is listed under it with the reason.
 */
const meta = {
	title: "Monti/Assistant/ProposalCard",
	component: ProposalCard,
	args: { title: "제안" },
	decorators: [
		(Story) => (
			<div className="w-[332px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ProposalCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const groups = (
	<>
		<ProposalRow name="다듬기" detail="발행 후 고친 글" count="3곳" />
		<ProposalRow name="요약 채우기" detail="고른 글" count="2편" />
		<ProposalRow name="2024 폴더로 옮기기" count="11편" />
		<ProposalRow name="휴지통으로" detail="쓰지 않는 이미지" count="3개" />
	</>
);

/** Waiting for review (flow 2 · 11): the groups, "상세 보기", "버리기" and the apply pill with the count. */
export const Waiting: Story = {
	args: {
		summary: "4묶음 · 19건",
		status: "검토 대기",
		children: groups,
		footer: (
			<ProposalActions
				reviewLabel="상세 보기"
				onReview={() => undefined}
				discardLabel="버리기"
				onDiscard={() => undefined}
				applyLabel="19건 적용"
				onApply={() => undefined}
			/>
		),
	},
};

/** Applied, one item not (flow 2 · 16): the result line with the time and "모두 되돌리기", then the item that failed with its reason. */
export const Applied: Story = {
	args: {
		summary: "4묶음 · 19건",
		status: "적용됨",
		statusTone: "success",
		children: groups,
		footer: (
			<ProposalResult
				appliedLabel="✓ 16건 적용"
				failedLabel="1건 못 함"
				time="10:52"
				undoLabel="모두 되돌리기"
				onUndo={() => undefined}
			/>
		),
		after: <ProposalRow name="못 옮김" detail="겨울 사진" count="그 사이 휴지통으로 감" tone="danger" />,
	},
};

/** New texts for media files (flow 2 · 19): each file's name and its proposed alt text; no review screen, so no "상세 보기". */
export const AltText: Story = {
	args: {
		summary: "대체 텍스트 · 3개",
		status: "검토 대기",
		children: (
			<>
				<ProposalItem title="desk-morning.jpg">
					<Ins>아침 햇빛이 드는 책상 위 노트북과 커피</Ins>
				</ProposalItem>
				<ProposalItem title="cover-cache.png">
					<Ins>밝은 종이 위에 놓인 캐시 글 제목</Ins>
				</ProposalItem>
				<ProposalItem title="seoul-night.jpg">
					<Ins>비 갠 밤, 불 켜진 서울 골목과 젖은 보도</Ins>
				</ProposalItem>
			</>
		),
		footer: (
			<ProposalActions
				discardLabel="버리기"
				onDiscard={() => undefined}
				applyLabel="3개 적용"
				onApply={() => undefined}
			/>
		),
	},
};

/** Discarded: faint, and it says so. */
export const Discarded: Story = {
	args: {
		summary: "태그 지우기 · 4개",
		status: "버림",
		statusTone: "subtle",
		muted: true,
		children: <ProposalRow name="태그 지우기" count="4개" />,
	},
};

/** Undone from the card: what was undone, and when. */
export const Reverted: Story = {
	args: {
		summary: "요약 채우기 · 2편",
		status: "되돌림 · 10:44",
		statusTone: "subtle",
		children: <ProposalRow name="요약 채우기" detail="고른 글" count="2편" />,
	},
};
