import { ChevronLeft } from "../../icons";
import {
	Button,
	Compare,
	CompareBody,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareSide,
	CompareText,
	CompareTitle,
	EditorHeader,
	Inline,
	Separator,
	Stack,
	Text,
	TextButton,
} from "../../index";

/**
 * An edit conflict: what was typed here beside the server's latest version, the words that differ marked on both sides. No status bar: the
 * title says it is a conflict and the head counts the differences once.
 */
export function EditorCompareScreen() {
	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			<EditorHeader>
				<Inline gap={16} minWidth={0} paddingX={12}>
					<TextButton variant="quiet">
						<ChevronLeft aria-hidden />
						편집기로
					</TextButton>
					<Text variant="title">서버 최신본과 비교</Text>
					<Text variant="meta" tone="faint" truncate>
						/posts/first-post
					</Text>
				</Inline>
				<Inline gap={16} justify="end" paddingX={12}>
					<Text variant="note" tone="subtle">
						다른 곳 3
					</Text>
					<Separator orientation="vertical" length="control" flush />
					<TextButton>서버 최신본 불러오기</TextButton>
					<Button>내 입력으로 저장</Button>
				</Inline>
			</EditorHeader>
			<Stack gap={0} grow minHeight={0} overflow="y">
				<Compare>
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
								목록에는 제목과 주소, 지금 상태만 남겼다.{" "}
								<CompareText changed>나머지는 필요할 때 꺼내 본다.</CompareText>
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
			</Stack>
		</Stack>
	);
}
