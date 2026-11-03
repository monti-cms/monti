import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
	Box,
	Del,
	Ins,
	ReviewCompare,
	ReviewCompareHead,
	ReviewGroup,
	ReviewItem,
	ReviewLine,
	ReviewMore,
	ReviewQuote,
	Text,
	TextButton,
} from "./index";

/**
 * The parts of the review page of one proposal: the quoted request, groups of changes with a check per row (in or out), side by side rows, and
 * the way to the rest of a long group.
 */
const meta = {
	title: "Monti/Proposal/Review",
	component: ReviewItem,
	args: { included: true, includeLabel: "넣기", title: "가을 여행 기록" },
	decorators: [
		(Story) => (
			<Box width="list">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ReviewItem>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A group with its rows: one in, one left out, one shown on one line. */
export const Group: Story = {
	render: () => (
		<>
			<ReviewQuote>“요약이 빈 글에 요약을 채워 줘”</ReviewQuote>
			<ReviewGroup
				title="요약 채우기"
				meta="글 2편 · 되돌릴 수 있음"
				actions={
					<>
						<TextButton variant="quiet">한 줄</TextButton>
						<TextButton variant="quiet">나란히</TextButton>
					</>
				}
			>
				<ReviewItem included includeLabel="넣기" title="가을 여행 기록" path="/posts/autumn-trip" end="요약">
					<Del>비어 있음</Del> → <Ins>단풍이 시작된 산길을 하루 동안 걸은 기록</Ins>
				</ReviewItem>
				<ReviewItem included={false} includeLabel="넣기" title="처음 쓰는 Monti" path="/posts/hello-monti" end="요약">
					<Del>비어 있음</Del> → <Ins>설정 파일 없이 사이트를 고치는 법</Ins>
				</ReviewItem>
			</ReviewGroup>
		</>
	),
};

/** A row that changed meanwhile: the check is out and read-only, the row is dimmed, and it says why. */
export const ChangedMeanwhile: Story = {
	render: () => (
		<ReviewGroup title="폴더 옮기기" meta="글 1편">
			<ReviewItem
				included={false}
				readOnly
				muted
				includeLabel="넣기"
				title="2023 회고"
				path="/posts/2023-review"
				end={
					<>
						<Text variant="note" tone="warning">
							이 사이에 고쳐짐
						</Text>
						<TextButton>다시 만들기</TextButton>
					</>
				}
			>
				폴더 없음 → <Ins>2024</Ins>
			</ReviewItem>
		</ReviewGroup>
	),
};

/** After applying: read-only checks and how each row went. */
export const Applied: Story = {
	render: () => (
		<ReviewGroup title="폴더 옮기기" meta="글 2편">
			<ReviewItem
				included
				readOnly
				includeLabel="넣기"
				title="2024 회고"
				path="/posts/2024-review"
				end={
					<Text variant="note" tone="success">
						✓ 2024로 옮김
					</Text>
				}
			/>
			<ReviewItem
				included
				readOnly
				includeLabel="넣기"
				title="겨울 준비"
				path="/posts/winter"
				end={
					<Text variant="note" tone="danger">
						못 함 · 그 사이 휴지통으로 감
					</Text>
				}
			/>
		</ReviewGroup>
	),
};

/** A group that changes blocks of one entry, on one line: the check and the block's name in the gutter, the text with its marks in place. */
export const OneLine: Story = {
	render: () => (
		<ReviewGroup
			title="다듬기"
			meta="발행 후 고친 글 · 3곳 · 되돌릴 수 있음"
			actions={
				<>
					<TextButton variant="underline">편집기에서 보기</TextButton>
					<TextButton variant="ink">한 줄</TextButton>
					<TextButton variant="quiet">나란히</TextButton>
				</>
			}
		>
			<ReviewLine included includeLabel="포함" label="요약">
				예시 코드를 고친 뒤 다시 정리한 <Del>메모입니다.</Del> <Ins>메모.</Ins> 바뀐 코드와 <Del>그</Del> 이유를 한 번에{" "}
				<Del>볼 수 있도록 정리했습니다.</Del> <Ins>봅니다.</Ins>
			</ReviewLine>
			<ReviewLine included includeLabel="포함" label="문단 1">
				<Del>처음 글을</Del> 발행하고 나서 예시 코드에 오타가 있다는 걸 <Del>알게 되었습니다. 그래서</Del>{" "}
				<Ins>알았습니다.</Ins> 코드를 <Del>고치고</Del> <Ins>고치면서</Ins> 글도 함께 손봤습니다.
			</ReviewLine>
			<ReviewLine included includeLabel="포함" label="문단 2" note="거의 다시 씀">
				<Del>
					바뀐 부분은 크게 두 가지입니다. 첫째, 함수 이름을 더 알기 쉽게 바꿨습니다. 둘째, 오류가 났을 때 무엇이
					잘못되었는지 알려 주는 메시지를 추가했습니다.
				</Del>
				<br />
				<Ins>함수 이름을 알기 쉽게 바꾸고, 오류가 나면 원인을 알려 주는 메시지를 넣었습니다.</Ins>
			</ReviewLine>
		</ReviewGroup>
	),
};

/** A text field side by side: now on the tool ground, the proposal next to it. */
export const SideBySide: Story = {
	render: () => (
		<ReviewGroup title="다듬기" meta="글 1편 · 되돌릴 수 있음">
			<ReviewCompareHead before="지금" after="제안" />
			<ReviewCompare
				included
				includeLabel="넣기"
				label="본문"
				note="대부분 고침"
				before="Monti는 글을 쓰는 사람이 코드를 몰라도 사이트를 고칠수 있게 해요."
				after="Monti는 글을 쓰는 사람이 코드를 몰라도 사이트를 고칠 수 있게 합니다."
			/>
		</ReviewGroup>
	),
};

/** A group of more than five rows: "6편 더 보기" while folded, "접기" once open. */
export const More: Story = {
	render: function Render() {
		const [open, setOpen] = useState(false);
		const rows = open ? 11 : 5;
		return (
			<ReviewGroup title="태그 정리" meta="글 11편">
				{Array.from({ length: rows }, (_, index) => (
					<ReviewItem
						key={index}
						included
						includeLabel="넣기"
						title={`여행 기록 ${index + 1}`}
						path={`/posts/trip-${index + 1}`}
						end="태그"
					/>
				))}
				<ReviewMore open={open} onOpenChange={setOpen} moreLabel="6편 더 보기" lessLabel="접기" />
			</ReviewGroup>
		);
	},
};
