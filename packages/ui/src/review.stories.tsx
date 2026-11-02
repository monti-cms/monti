import type { Meta, StoryObj } from "@storybook/react-vite";
import { Caret } from "./caret";
import { Count } from "./count";
import { PageColumn, PageHeader } from "./page-header";
import { Del, Ins } from "./proposal-marks";
import { ReviewCompare, ReviewCompareHead, ReviewGroup, ReviewItem, ReviewQuote } from "./review";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { TextButton } from "./text-button";

/** The review page of a proposal: the request quoted, then each group of changes with a check per change; side by side for text that was rewritten. */
const meta = {
	title: "Monti/Assistant/Review",
	component: ReviewGroup,
	parameters: { layout: "fullscreen" },
	args: { title: "" },
} satisfies Meta<typeof ReviewGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

const page = (children: React.ReactNode) => (
	<PageColumn>
		<PageHeader title="제안 검토" meta="10. 26 10:51" />
		<ReviewQuote>“이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮겨 줘.”</ReviewQuote>
		{children}
	</PageColumn>
);

/** One line per change (flow 2 · 12): a field filled, one left out because it changed meanwhile, and entries moved. */
export const OneLine: Story = {
	render: () =>
		page(
			<>
				<ReviewGroup title="요약 채우기" meta="글 2편 · 되돌릴 수 있음">
					<ReviewItem included includeLabel="포함" title="타입 정리 메모" path="/types-memo" end={<Count>요약</Count>}>
						<Del>비어 있음</Del> → <Ins>자주 헷갈리는 타입 세 가지를 예시 하나씩으로 정리한 메모.</Ins>
					</ReviewItem>
					<ReviewItem
						included={false}
						includeLabel="포함"
						title="쓰는 중인 글"
						path="/draft-post"
						muted
						end={
							<>
								<span className="text-monti-caption text-monti-warning">이 사이에 고쳐짐</span>
								<TextButton variant="underline">다시 만들기</TextButton>
							</>
						}
					>
						<Del>비어 있음</Del> → <Ins>글보다 도구를 고치는 데 시간을 더 쓰게 된 이유와 그 정리.</Ins>
					</ReviewItem>
				</ReviewGroup>
				<ReviewGroup
					title="2024 폴더로 옮기기"
					meta="글 11편 · 되돌릴 수 있음"
					actions={<TextButton>11편 모두 빼기</TextButton>}
				>
					<ReviewItem
						included
						includeLabel="포함"
						title="2024 회고"
						path="/retro-2024"
						end={<Count>폴더 없음 → 2024</Count>}
					/>
					<ReviewItem
						included
						includeLabel="포함"
						title="리액트 18 정리"
						path="/react-18"
						end={<Count>폴더 없음 → 2024</Count>}
					/>
					<TextButton variant="quiet">
						6편 더 보기
						<Caret />
					</TextButton>
				</ReviewGroup>
			</>,
		),
};

/** Side by side (flow 2 · 13): the text as it is and as proposed, with the field's name and the check in the gutter. */
export const SideBySide: Story = {
	render: () =>
		page(
			<ReviewGroup
				title="요약 바꾸기"
				meta="글 1편 · 되돌릴 수 있음"
				actions={
					<Tabs defaultValue="side">
						<TabsList>
							<TabsTrigger value="line">한 줄</TabsTrigger>
							<TabsTrigger value="side">나란히</TabsTrigger>
						</TabsList>
					</Tabs>
				}
			>
				<ReviewCompareHead before="지금" after="제안" />
				<ReviewCompare
					included
					includeLabel="포함"
					label="요약"
					before={
						<>
							예시 코드를 고친 뒤 다시 정리한 <Del>메모입니다.</Del>
						</>
					}
					after={
						<>
							예시 코드를 고친 뒤 다시 정리한 <Ins>메모.</Ins>
						</>
					}
				/>
			</ReviewGroup>,
		),
};
