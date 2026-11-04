import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	Button,
	Compare,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareRow,
	CompareRows,
	CompareShared,
	CompareSide,
	CompareText,
	CompareTitle,
	Heading,
	Highlight,
	Text,
} from "./index";

/**
 * Two versions of one entry side by side: no gap, one rule between, 48px inside each side. Each side has its name in the small mono line, the
 * properties that differ, then the entry as it reads. The words that differ are on the highlight on both sides.
 */
const meta = {
	title: "Monti/Change/Compare",
	component: Compare,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<Box height="screen" background="page">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof Compare>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditConflict: Story = {
	render: () => (
		<Compare>
			<CompareSide
				label="내 입력 · 저장 안 됨"
				properties={
					<>
						<CompareProperty label="요약" empty="비어 있음">
							설정 파일 없이 사이트를 고치는 법
						</CompareProperty>
						<CompareProperty label="태그" empty="비어 있음">
							입문, 설정
						</CompareProperty>
					</>
				}
			>
				<CompareTitle>처음 쓰는 Monti</CompareTitle>
				<CompareBody>
					<CompareParagraph>
						Monti는 글을 쓰는 사람이 <CompareText changed>설정 파일을 열지 않아도</CompareText> 사이트를 고칠 수 있게
						합니다.
					</CompareParagraph>
					<CompareHeading>시작하기</CompareHeading>
					<CompareParagraph>왼쪽 목록에서 컬렉션을 고르고 새 글을 씁니다.</CompareParagraph>
					<CompareCode>pnpm create monti</CompareCode>
				</CompareBody>
			</CompareSide>
			<CompareSide
				label="서버 최신본 · v9 · 10:41 저장"
				properties={
					<>
						<CompareProperty label="요약" empty="비어 있음" />
						<CompareProperty label="태그" empty="비어 있음">
							입문
						</CompareProperty>
					</>
				}
			>
				<CompareTitle>처음 쓰는 Monti</CompareTitle>
				<CompareBody>
					<CompareParagraph>
						Monti는 글을 쓰는 사람이 <CompareText changed>코드를 몰라도</CompareText> 사이트를 고칠 수 있게 합니다.
					</CompareParagraph>
					<CompareHeading>시작하기</CompareHeading>
					<CompareParagraph>왼쪽 목록에서 컬렉션을 고르고 새 글을 씁니다.</CompareParagraph>
					<CompareCode>pnpm create monti</CompareCode>
				</CompareBody>
			</CompareSide>
		</Compare>
	),
};

/** The sides differ only in the text: no properties block. */
export const TextOnly: Story = {
	render: () => (
		<Compare>
			<CompareSide label="내 입력 · 저장 안 됨">
				<CompareTitle>
					<CompareText changed>가을 여행</CompareText> 기록
				</CompareTitle>
				<CompareBody>
					<CompareParagraph>단풍이 시작된 산길을 걸었습니다.</CompareParagraph>
				</CompareBody>
			</CompareSide>
			<CompareSide label="서버 최신본 · v4 · 09:12 저장">
				<CompareTitle>
					<CompareText changed>10월</CompareText> 기록
				</CompareTitle>
				<CompareBody>
					<CompareParagraph>단풍이 시작된 산길을 걸었습니다.</CompareParagraph>
				</CompareBody>
			</CompareSide>
		</Compare>
	),
};

const CODE = "export default function Post({ title }) {\n  // 제목을 그대로 보여 준다\n  return <h1>{title}</h1>;\n}";

/**
 * A translation next to its source, block by block (the translation's 나란히 view): the kind of each block on the left, the source on the tool ground,
 * the translation on the page. A block whose source changed since it was translated says so under its kind, and the words that changed are highlighted;
 * a block added to the source and not translated yet shows the source, faint, in the translation's place. A block the translation shares with its source
 * (code) is `CompareShared`: the source's block, faint, with the button that makes a copy of its own. The title row is `title`.
 */
export const TranslationRows: Story = {
	render: () => (
		<Box paddingX={40} paddingY={24}>
			<CompareRows>
				<CompareRow head source="원문 · 한국어 · 10. 26 수정" translation="번역 · English · 09. 20 수정" />
				<CompareRow
					name="제목"
					title
					source={<Heading variant="page">첫 번째 글</Heading>}
					translation={<Heading variant="page">The first post</Heading>}
				/>
				<CompareRow
					name="문단"
					source={
						<Text variant="reading">
							블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.
						</Text>
					}
					translation={
						<Text variant="reading">
							I rebuilt the blog because I was spending more time fixing tools than writing.
						</Text>
					}
				/>
				<CompareRow
					name="문단"
					note="원문 바뀜"
					current
					source={
						<Text variant="reading">
							목록에는 제목과 주소, 지금 상태만 남겼다. <Highlight>나머지는 필요할 때 꺼내 본다.</Highlight>
						</Text>
					}
					translation={<Text variant="reading">The list keeps only the title, the address and the status.</Text>}
				/>
				<CompareRow
					name="코드 블록"
					source={<CompareCode>{CODE}</CompareCode>}
					translation={
						<CompareShared
							action={
								<Button variant="ghost" size="sm">
									English에서만 따로 고치기
								</Button>
							}
						>
							<CompareCode>{CODE}</CompareCode>
						</CompareShared>
					}
				/>
				<CompareRow
					name="문단"
					note="원문에 추가"
					source={<Text variant="reading">편집기도 같은 원칙으로 정리했다.</Text>}
					translation={
						<Text variant="reading" tone="faint">
							편집기도 같은 원칙으로 정리했다.
						</Text>
					}
				/>
			</CompareRows>
		</Box>
	),
};
