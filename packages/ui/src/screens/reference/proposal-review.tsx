import { ChevronLeft } from "../../icons";
import {
	Button,
	PageColumn,
	PageHeader,
	ReviewCompare,
	ReviewCompareHead,
	ReviewGroup,
	ReviewItem,
	ReviewLine,
	ReviewMore,
	ReviewQuote,
	Separator,
	Stack,
	TabLink,
	TabLinks,
	Text,
	TextButton,
} from "../../index";
import { type Marked, marked } from "./assistant-parts";
import { AdminFrame } from "./frame";

const none = () => {};

/** One block of the "다듬기" group: its name, the words now and proposed, and the two marked as one line. */
const blocks: readonly { label: string; line: Marked; before: Marked; after: Marked }[] = [
	{
		label: "요약",
		line: [
			"예시 코드를 고친 뒤 다시 정리한 ",
			["del", "메모입니다."],
			" ",
			["ins", "메모."],
			" 바뀐 코드와 ",
			["del", "그"],
			" 이유를 한 번에 ",
			["del", "볼 수 있도록 정리했습니다."],
			" ",
			["ins", "봅니다."],
		],
		before: [
			"예시 코드를 고친 뒤 다시 정리한 ",
			["del", "메모입니다."],
			" 바뀐 코드와 ",
			["del", "그"],
			" 이유를 한 번에 ",
			["del", "볼 수 있도록 정리했습니다."],
		],
		after: ["예시 코드를 고친 뒤 다시 정리한 ", ["ins", "메모."], " 바뀐 코드와 이유를 한 번에 ", ["ins", "봅니다."]],
	},
	{
		label: "문단 1",
		line: [
			["del", "처음 글을"],
			" 발행하고 나서 예시 코드에 오타가 있다는 걸 ",
			["del", "알게 되었습니다. 그래서"],
			" ",
			["ins", "알았습니다."],
			" 코드를 ",
			["del", "고치고"],
			" ",
			["ins", "고치면서"],
			" 글도 함께 손봤습니다.",
		],
		before: [
			["del", "처음 글을"],
			" 발행하고 나서 예시 코드에 오타가 있다는 걸 ",
			["del", "알게 되었습니다. 그래서"],
			" 코드를 ",
			["del", "고치고"],
			" 글도 함께 손봤습니다.",
		],
		after: [
			"발행하고 나서 예시 코드에 오타가 있다는 걸 ",
			["ins", "알았습니다."],
			" 코드를 ",
			["ins", "고치면서"],
			" 글도 함께 손봤습니다.",
		],
	},
	{
		label: "문단 2",
		line: [
			[
				"del",
				"바뀐 부분은 크게 두 가지입니다. 첫째, 함수 이름을 더 알기 쉽게 바꿨습니다. 둘째, 오류가 났을 때 무엇이 잘못되었는지 알려 주는 메시지를 추가했습니다. 이 두 가지 덕분에 코드를 처음 보는 사람도 흐름을 따라가기 쉬워졌습니다.",
			],
			" ",
			[
				"ins",
				"함수 이름을 알기 쉽게 바꾸고, 오류가 나면 원인을 알려 주는 메시지를 넣었습니다. 처음 보는 사람도 흐름을 따라가기 쉬워졌습니다.",
			],
		],
		before: [
			"바뀐 부분은 크게 두 가지입니다. 첫째, 함수 이름을 더 알기 쉽게 바꿨습니다. 둘째, 오류가 났을 때 무엇이 잘못되었는지 알려 주는 메시지를 추가했습니다. 이 두 가지 덕분에 코드를 처음 보는 사람도 흐름을 따라가기 쉬워졌습니다.",
		],
		after: [
			"함수 이름을 알기 쉽게 바꾸고, 오류가 나면 원인을 알려 주는 메시지를 넣었습니다. 처음 보는 사람도 흐름을 따라가기 쉬워졌습니다.",
		],
	},
];

const moves: readonly { title: string; path: string; included: boolean }[] = [
	{ title: "2024 회고", path: "/retro-2024", included: true },
	{ title: "리액트 18 정리", path: "/react-18", included: true },
	{ title: "겨울 사진", path: "/winter-photos", included: true },
	{ title: "타입스크립트 5.4", path: "/ts-54", included: false },
	{ title: "블로그 이전 기록", path: "/blog-move", included: true },
];

/** The review page of the assistant's proposal: what was asked, then each group of changes; `side` shows the rewrites side by side. */
export function ProposalReviewView({ side = false }: { side?: boolean }) {
	return (
		<AdminFrame open={null}>
			<PageColumn>
				<TextButton variant="quiet" size="note">
					<ChevronLeft aria-hidden />
					어시스턴트
				</TextButton>
				<Stack gap={0} paddingTop={2}>
					<PageHeader title="제안 검토" meta="10. 26 10:51">
						<Button variant="ghost">버리기</Button>
						<Button>17건 적용</Button>
					</PageHeader>
				</Stack>
				<ReviewQuote>
					“이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고, ‘발행 후 고친 글’은 더 짧게 다듬어 줘. 쓰지 않는
					이미지도 지워 줘.”
				</ReviewQuote>
				<ReviewGroup
					title="다듬기"
					meta="발행 후 고친 글 · 3곳 · 되돌릴 수 있음"
					actions={
						<>
							<Button variant="ghost" size="sm">
								편집기에서 보기
							</Button>
							<Separator orientation="vertical" length="control" flush />
							<TabLinks>
								<TabLink current={!side}>한 줄</TabLink>
								<TabLink current={side}>나란히</TabLink>
							</TabLinks>
						</>
					}
				>
					{side ? <ReviewCompareHead before="지금" after="제안" /> : null}
					{blocks.map((block) =>
						side ? (
							<ReviewCompare
								key={block.label}
								included
								includeLabel={`${block.label} 넣기`}
								label={block.label}
								before={marked(block.before)}
								after={marked(block.after)}
							/>
						) : (
							<ReviewLine key={block.label} included includeLabel={`${block.label} 넣기`} label={block.label}>
								{marked(block.line)}
							</ReviewLine>
						),
					)}
				</ReviewGroup>
				<ReviewGroup title="요약 채우기" meta="글 2편 · 되돌릴 수 있음">
					<ReviewItem
						included
						includeLabel="타입 정리 메모 넣기"
						title="타입 정리 메모"
						path="/types-memo"
						end={
							<Text variant="micro" tone="subtle">
								요약
							</Text>
						}
					>
						{marked([
							["del", "비어 있음"],
							" → ",
							["ins", "자주 헷갈리는 타입 세 가지를 예시 하나씩으로 정리한 메모."],
						])}
					</ReviewItem>
					<ReviewItem
						included={false}
						includeLabel="쓰는 중인 글 넣기"
						title="쓰는 중인 글"
						path="/draft-post"
						muted
						end={
							<>
								<Text variant="caption" tone="warning">
									이 사이에 고쳐짐
								</Text>{" "}
								<TextButton variant="underline" size="caption">
									다시 만들기
								</TextButton>
							</>
						}
					>
						{marked([
							["del", "비어 있음"],
							" → ",
							["ins", "글보다 도구를 고치는 데 시간을 더 쓰게 된 이유와 그 정리."],
						])}
					</ReviewItem>
				</ReviewGroup>
				<ReviewGroup
					title="2024 폴더로 옮기기"
					meta="글 11편 · 되돌릴 수 있음"
					actions={
						<Button variant="ghost" size="sm">
							11편 모두 빼기
						</Button>
					}
				>
					{moves.map((move) => (
						<ReviewItem
							key={move.path}
							included={move.included}
							includeLabel={`${move.title} 넣기`}
							title={move.title}
							path={move.path}
							end={
								<Text mono variant="meta" tone="subtle">
									폴더 없음 → 2024
								</Text>
							}
						/>
					))}
					<ReviewMore open={false} onOpenChange={none} moreLabel="6편 더 보기" lessLabel="접기" />
				</ReviewGroup>
				<ReviewGroup title="휴지통으로 보내기" meta="파일 3개 · 41 MB · 되돌릴 수 있음">
					<ReviewItem
						included
						includeLabel="쓰지 않는 이미지 3개 넣기"
						title="쓰지 않는 이미지 3개"
						path="old-cover.png · scan-01.jpg · tmp.gif"
					/>
				</ReviewGroup>
			</PageColumn>
		</AdminFrame>
	);
}

export function ProposalReviewScreen() {
	return <ProposalReviewView />;
}
