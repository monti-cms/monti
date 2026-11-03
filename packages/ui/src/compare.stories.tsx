import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	Compare,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareSide,
	CompareText,
	CompareTitle,
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
