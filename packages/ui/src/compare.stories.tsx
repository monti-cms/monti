import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Compare,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareSide,
	CompareText,
	CompareTitle,
} from "./compare";

/**
 * Two versions of one entry side by side (an edit conflict, a draft kept in the browser). Two columns with no gap and a rule between them; each column
 * has its name, the properties that differ, and the entry. The words that differ sit on the highlight, the same way on both sides. The columns are
 * not lined up row by row: each reads as the entry itself.
 */
const meta = {
	title: "Patterns/Compare",
	component: Compare,
	parameters: { bleed: true },
	// The screen gives it the height between the header and the status bar: the rule between the columns runs the whole way.
	decorators: [
		(Story) => (
			<div className="flex min-h-screen flex-col">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Compare>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	tags: ["visual"],
	render: (args) => (
		<Compare {...args}>
			<CompareSide
				label="내 입력 · 저장 안 됨"
				properties={
					<CompareProperty label="요약" empty="비어 있음">
						리액트로 블로그를 다시 만들며 <CompareText changed>덜어낸 것과 남긴 것.</CompareText>
					</CompareProperty>
				}
			>
				<CompareTitle>첫 번째 글</CompareTitle>
				<CompareBody>
					<CompareParagraph>
						블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.
					</CompareParagraph>
					<CompareHeading>무엇을 덜어냈나</CompareHeading>
					<CompareParagraph>
						목록에는 제목과 주소, 지금 상태만 남겼다. <CompareText changed>나머지는 필요할 때 꺼내 본다.</CompareText>
					</CompareParagraph>
					<CompareParagraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</CompareParagraph>
				</CompareBody>
			</CompareSide>
			<CompareSide
				label="서버 최신본 · v4 · 10:41 저장"
				properties={<CompareProperty label="요약" empty="비어 있음" />}
			>
				<CompareTitle>첫 번째 글</CompareTitle>
				<CompareBody>
					<CompareParagraph>
						블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.
					</CompareParagraph>
					<CompareHeading>무엇을 덜어냈나</CompareHeading>
					<CompareParagraph>
						목록에는 제목과 주소, 지금 상태만 남겼다. <CompareText changed>설정 화면은 그대로 두었다.</CompareText>
					</CompareParagraph>
					<CompareParagraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</CompareParagraph>
					<CompareHeading>
						<CompareText changed>남긴 것</CompareText>
					</CompareHeading>
					<CompareParagraph>
						<CompareText changed>편집기의 블록 손잡이와 / 넣기는 그대로 두었다.</CompareText>
					</CompareParagraph>
				</CompareBody>
			</CompareSide>
		</Compare>
	),
};

/** The sides are the same in their properties: the properties block is left out and the title comes right under the name. */
export const NoPropertyDiffers: Story = {
	render: (args) => (
		<Compare {...args}>
			<CompareSide label="임시 저장본 · 이 브라우저 · 10. 26 10:12">
				<CompareTitle>
					<CompareText changed>둘째 글 고치는 중</CompareText>
				</CompareTitle>
				<CompareBody>
					<CompareParagraph>첫 문단.</CompareParagraph>
				</CompareBody>
			</CompareSide>
			<CompareSide label="서버 저장본 · 10. 26 09:58">
				<CompareTitle>
					<CompareText changed>둘째 글</CompareText>
				</CompareTitle>
				<CompareBody>
					<CompareParagraph>첫 문단.</CompareParagraph>
				</CompareBody>
			</CompareSide>
		</Compare>
	),
};

/** Code and a list read as they are: line breaks are kept, code is in the inner box. */
export const CodeAndLists: Story = {
	render: (args) => (
		<Compare {...args}>
			<CompareSide label="내 입력 · 저장 안 됨">
				<CompareTitle>예제</CompareTitle>
				<CompareBody>
					<CompareParagraph>{"목록 하나\n목록 둘"}</CompareParagraph>
					<CompareCode>
						const answer = <CompareText changed>42</CompareText>
						{";"}
					</CompareCode>
				</CompareBody>
			</CompareSide>
			<CompareSide label="서버 최신본 · v4 · 10:41 저장">
				<CompareTitle>예제</CompareTitle>
				<CompareBody>
					<CompareParagraph>{"목록 하나\n목록 둘\n목록 셋"}</CompareParagraph>
					<CompareCode>{"const answer = 41;"}</CompareCode>
				</CompareBody>
			</CompareSide>
		</Compare>
	),
};

/** Several properties differ: each is a name over its value, and a value that is empty on one side says so, faint. */
export const SeveralProperties: Story = {
	render: (args) => (
		<Compare {...args}>
			<CompareSide
				label="내 입력 · 저장 안 됨"
				properties={
					<>
						<CompareProperty label="주소" empty="비어 있음">
							<CompareText changed>first-post-2</CompareText>
						</CompareProperty>
						<CompareProperty label="요약" empty="비어 있음" />
					</>
				}
			>
				<CompareTitle>첫 번째 글</CompareTitle>
			</CompareSide>
			<CompareSide
				label="서버 최신본 · v4 · 10:41 저장"
				properties={
					<>
						<CompareProperty label="주소" empty="비어 있음">
							<CompareText changed>first-post</CompareText>
						</CompareProperty>
						<CompareProperty label="요약" empty="비어 있음">
							<CompareText changed>글을 한 줄로 소개합니다.</CompareText>
						</CompareProperty>
					</>
				}
			>
				<CompareTitle>첫 번째 글</CompareTitle>
			</CompareSide>
		</Compare>
	),
};
