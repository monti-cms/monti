import {
	Box,
	CompareBody,
	CompareRow,
	CompareRows,
	CompareShared,
	CompareText,
	DocCallout,
	DocCode,
	DocTable,
	FormField,
	FormFieldLabel,
	Heading,
	Image,
	Inline,
	Input,
	ReadValue,
	Segmented,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	TabLink,
	TabLinks,
	Text,
	TextButton,
	Untranslated,
} from "../../index";
import { EntryHeader, still } from "./editor-notion";

const CODE = "export default function Post({ title }) {\n  // 제목을 그대로 보여 준다\n  return <h1>{title}</h1>;\n}";

/** An image block's side: the picture and its fields. */
function ImageSide({ children, faint }: { children: React.ReactNode; faint?: boolean }) {
	return (
		<Inline gap={16} align="start">
			<Box width="rail" shrink={false} dimmed={faint}>
				<Image src={null} alt="" ratio="photo" radius="md" />
			</Box>
			<Stack gap={12} grow>
				{children}
			</Stack>
		</Inline>
	);
}

/** A translation beside its source block by block (the 나란히 view). */
export function TranslatePairedScreen() {
	return (
		<Stack gap={0} minHeight="screen" background="page">
			<EntryHeader address="/en/posts/first-post" status="published" statusLabel="발행됨" panelOpen={false} />
			<Inline gap={0} align="stretch" border="bottom">
				{/* The same language tabs as the editor's: one tab, one page. */}
				<Inline grow minWidth={0} minHeight="panebar" paddingX={24}>
					<TabLinks>
						<TabLink>한국어</TabLink>
						<TabLink current>English</TabLink>
						<TabLink render={<button type="button" />}>+ 언어</TabLink>
					</TabLinks>
				</Inline>
				<Inline minHeight="panebar" gap={8} paddingX={24} shrink={false}>
					<Text variant="note" tone="subtle">
						원문
					</Text>
					<Segmented
						aria-label="원문 보기"
						value="나란히"
						onValueChange={still}
						options={[
							{ value: "끔", label: "끔" },
							{ value: "옆 창", label: "옆 창" },
							{ value: "나란히", label: "나란히" },
						]}
						size="sm"
						inline
					/>
				</Inline>
			</Inline>
			<Box grow paddingX={40} paddingTop={24} paddingBottom={48}>
				<Box maxWidth="list" paddingX={8} centered>
					<CompareRows>
						<CompareRow head source="10. 26 수정" translation="09. 20 수정" />
						<CompareRow
							title
							source={
								<Heading as="h2" variant="page">
									첫 번째 글
								</Heading>
							}
							translation={
								<Heading as="h2" variant="page">
									The first post
								</Heading>
							}
						/>
						<CompareRow
							source={
								<CompareBody>
									블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.
								</CompareBody>
							}
							translation={
								<CompareBody>
									I rebuilt the blog because I was spending more time fixing tools than writing.
								</CompareBody>
							}
						/>
						<CompareRow
							note="원문 바뀜"
							current
							source={
								<CompareBody>
									목록에는 제목과 주소, 지금 상태만 남겼다.{" "}
									<CompareText changed>나머지는 필요할 때 꺼내 본다.</CompareText>
								</CompareBody>
							}
							translation={<CompareBody>The list keeps only the title, the address and the status.</CompareBody>}
						/>
						<CompareRow
							source={
								<CompareBody>
									<DocCallout source>
										<p>버전 안내</p>
										<p>이 글은 리액트 19 기준이다.</p>
										<p>예시 코드는 저장소에 있다.</p>
									</DocCallout>
								</CompareBody>
							}
							translation={
								<CompareBody>
									<DocCallout>
										<p>About versions</p>
										<p>This post is based on React 19.</p>
										<p>The example code is in the repository.</p>
									</DocCallout>
								</CompareBody>
							}
						/>
						<CompareRow
							source={
								<ImageSide>
									<ReadValue label="캡션">서울의 밤, 작업실 창밖</ReadValue>
									<ReadValue label="대체 텍스트">불 켜진 아파트 창과 남산타워</ReadValue>
								</ImageSide>
							}
							translation={
								<ImageSide faint>
									<FormField>
										<FormFieldLabel htmlFor="ref-caption">캡션</FormFieldLabel>
										<Input id="ref-caption" defaultValue="Seoul at night, from my desk" />
									</FormField>
									<FormField>
										<FormFieldLabel htmlFor="ref-alt">대체 텍스트</FormFieldLabel>
										<Input id="ref-alt" placeholder="아직 번역하지 않았어요" />
									</FormField>
								</ImageSide>
							}
						/>
						<CompareRow
							source={<DocCode source>{CODE}</DocCode>}
							translation={
								<CompareShared action={<TextButton variant="underline">따로 고치기</TextButton>}>
									<DocCode>{CODE}</DocCode>
								</CompareShared>
							}
						/>
						<CompareRow
							source={
								<DocTable
									head={["버전", "바뀐 점", "옮길 때"]}
									rows={[
										["18", "훅 도입 이후 안정", "그대로"],
										["19", "서버 컴포넌트 정식", "데이터 불러오기 정리"],
									]}
								/>
							}
							translation={
								<DocTable
									head={["Version", "What changed", "When moving"]}
									rows={[
										["18", "Stable since hooks", "Keep as is"],
										["19", "Server components are stable", "데이터 불러오기 정리"],
									]}
								/>
							}
						/>
						<CompareRow
							source={
								<CompareBody>
									<ul>
										<li>제목과 주소</li>
										<li>지금 상태</li>
										<li>수정한 날짜</li>
									</ul>
								</CompareBody>
							}
							translation={
								<CompareBody>
									<ul>
										<li>Title and address</li>
										<li>Current status</li>
										<li>Date of last edit</li>
									</ul>
								</CompareBody>
							}
						/>
						<CompareRow
							note="원문에 추가"
							source={<CompareBody>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</CompareBody>}
							translation={
								<CompareBody>
									<Untranslated>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</Untranslated>
								</CompareBody>
							}
						/>
					</CompareRows>
				</Box>
			</Box>
			<StatusBar>
				<StatusBarCell>할 일 1</StatusBarCell>
				<StatusBarSpacer />
				<StatusBarCell end>912자</StatusBarCell>
			</StatusBar>
		</Stack>
	);
}
