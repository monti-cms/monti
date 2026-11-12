import type * as React from "react";
import { ChangesBar } from "../../changes-group";
import { ChevronLeft, Close } from "../../icons";
import {
	Button,
	ChangeGroup,
	ChangeLine,
	ChangeLines,
	ChangeNote,
	Checkbox,
	Compare,
	CompareBody,
	CompareParagraph,
	CompareProperty,
	CompareRow,
	CompareRows,
	CompareSide,
	CompareText,
	CompareTitle,
	DragHandle,
	type FieldRow,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	Ins,
	ListSection,
	MediaInput,
	OptionRow,
	OptionTable,
	PageBody,
	PageColumn,
	PageHeader,
	RadioGroup,
	RadioItem,
	RowTitle,
	Select,
	SelectTrigger,
	SelectValue,
	Separator,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetTitle,
	Stack,
	StandalonePage,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
} from "../../index";
import {
	EditorPage,
	EntryHeader,
	EntryProperties,
	EntryTitle,
	LanguageTabs,
	NotionStatusBar,
	Paragraph,
} from "./editor-notion";
import { FieldAbout, REQUIRED, SwitchRule } from "./field-sheet-parts";
import { AdminFrame } from "./frame";
import { SchemaPage } from "./schema";
import { ShownSelect } from "./settings";

type Field = React.ComponentProps<typeof FieldRow>;

// An option's band ends with the way to add a field to it; an option with no fields keeps its band, so there is a place to add the first.
const ADD = (
	<TextButton variant="quiet" size="note">
		+ 필드
	</TextButton>
);

/**
 * Doc 19, mockups for the owner's look (not built screens): a conditional field is a choice with a group of fields for each option. Everything
 * here is drawn with parts the built screens already use.
 */
const FIELDS: Field[] = [
	{ name: "title !", label: "제목", note: "속성 패널에 안 나옴", kind: "text" },
	{ name: "slug !", label: "주소", kind: "slug" },
	{ name: "format !", label: "글 종류", kind: "conditional · 3" },
	// Each option is a band under the choice, one step in, with no grip (the sheet orders the options) and its value after its name; its fields sit one step further in.
	{ name: "글", group: true, grip: false, depth: 1, note: "article · 필드 없음", kind: ADD },
	{ name: "동영상", group: true, grip: false, depth: 1, note: "video", kind: ADD },
	{ name: "videoUrl !", label: "동영상 주소", kind: "text", depth: 2 },
	{ name: "poster", label: "미리보기 그림", kind: "image", depth: 2 },
	{ name: "링크", group: true, grip: false, depth: 1, note: "link", kind: ADD },
	{ name: "linkUrl !", label: "링크 주소", kind: "text", depth: 2 },
	{ name: "summary", label: "요약", kind: "text · 120" },
	// A group of the panel, to tell the two apart: at the list's edge, with a grip, its name alone.
	{ name: "분류", group: true },
	{ name: "category", label: "카테고리", kind: "→ category", depth: 1 },
	{ name: "tags", label: "태그", kind: "[] → tag", depth: 1 },
];

/** 2. The fields list: the conditional field, then a band for each option with fields, its fields inside it. */
export function ConditionalFieldsScreen() {
	return (
		<AdminFrame open="settings">
			<SchemaPage fields={FIELDS} />
		</AdminFrame>
	);
}

const OPTIONS = [
	{ value: "article", label: "글" },
	{ value: "video", label: "동영상" },
	{ value: "link", label: "링크" },
];

/** 1. The field sheet of a conditional field: what any field has, then its options, their fields are added in the fields list. */
export function ConditionalFieldSheetScreen() {
	return (
		<AdminFrame open="settings" corner={false}>
			<SchemaPage fields={FIELDS} />
			<Sheet open>
				<SheetContent>
					<SheetHeader>
						<SheetTitle of="· 게시글" ofMono={false}>
							글 종류
						</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<FieldAbout kind="조건부" name="format" label="글 종류" about="글의 형식. 형식마다 채울 것이 다르다." />
						<SheetSection title="선택지">
							<Stack gap={8}>
								<OptionTable>
									{OPTIONS.map((option) => (
										<OptionRow
											key={option.value}
											handle={<DragHandle aria-label={`끌어서 순서 바꾸기: ${option.value}`} />}
											value={<Input appearance="inline" mono aria-label="값" defaultValue={option.value} />}
											label={<Input appearance="inline" aria-label="라벨" defaultValue={option.label} />}
											action={
												<IconButton label={`${option.label} 빼기`} size="sm">
													<Close aria-hidden />
												</IconButton>
											}
										/>
									))}
								</OptionTable>
								<Inline>
									<Button variant="ghost" size="sm">
										+ 선택지 추가
									</Button>
								</Inline>
							</Stack>
						</SheetSection>
						<SheetSection title="입력 규칙">
							<Stack gap={4}>
								<SwitchRule label={REQUIRED} checked />
							</Stack>
						</SheetSection>
					</SheetBody>
					<SheetFooter>
						<Inline gap={12} grow minWidth={0}>
							<Button variant="ghost-danger">필드 삭제</Button>
						</Inline>
						<Button variant="ghost">취소</Button>
						<Button>저장</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</AdminFrame>
	);
}

/** The property panel's conditional field: the choice, then the chosen option's fields right under it. */
function FormatFields({ changed }: { changed?: boolean }) {
	return (
		<>
			<FormField>
				<FormFieldLabel>글 종류</FormFieldLabel>
				<Select items={[{ value: "v", label: changed ? "링크" : "동영상" }]} value="v">
					<SelectTrigger size="md" width="full">
						<SelectValue />
					</SelectTrigger>
				</Select>
				{changed ? (
					<Text variant="caption" tone="warning">
						저장하면 동영상의 값 2개가 지워집니다
					</Text>
				) : null}
			</FormField>
			{changed ? (
				<FormField>
					<FormFieldLabel htmlFor="ref-link" required>
						링크 주소
					</FormFieldLabel>
					<Input size="md" id="ref-link" placeholder="비어 있음" />
				</FormField>
			) : (
				<>
					<FormField>
						<FormFieldLabel htmlFor="ref-video" required>
							동영상 주소
						</FormFieldLabel>
						<Input size="md" id="ref-video" defaultValue="https://example.dev/talk.mp4" />
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="ref-poster">미리보기 그림</FormFieldLabel>
						<MediaInput
							id="ref-poster"
							size="md"
							value={{ name: "talk-poster.png" }}
							onClear={() => {}}
							clearLabel="빼기"
						/>
					</FormField>
				</>
			)}
		</>
	);
}

/** 3. The property panel before (`changed` off) and after the choice is changed: the other option's fields are gone, and the line says what a save drops. */
export function ConditionalPanelScreen({ changed = false }: { changed?: boolean }) {
	return (
		<EditorPage
			header={<EntryHeader address="/posts/first-post" status="editing" statusLabel="수정 중" />}
			head={<LanguageTabs />}
			side={<EntryProperties summary={<FormatFields changed={changed} />} />}
			statusBar={<NotionStatusBar />}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
		</EditorPage>
	);
}

/** 4. The review when an option is taken out: the choice's line with the entries that had it chosen, then its fields as removed fields. */
export function ConditionalReviewScreen() {
	return (
		<AdminFrame open="settings" corner={false}>
			<SchemaPage
				fields={FIELDS.filter((field) => !["동영상", "videoUrl !", "poster"].includes(String(field.name)))}
				changed
				head={<ChangesBar label="변경 사항" count={3} discardLabel="모두 되돌리기" saveLabel="저장하고 적용" />}
			/>
			<Sheet open>
				<SheetContent>
					<SheetHeader>
						<SheetTitle of="· 게시글 · 변경 사항 3">검토</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<Stack gap={0}>
							<ChangeGroup kind="drop" tag="삭제" title="글 종류 · 동영상" identifier="format · video">
								<ChangeLines>
									<ChangeLine what="고른 글" then="12편" />
								</ChangeLines>
								<ChangeNote danger>이 글들은 글 종류를 고르지 않은 글이 됩니다.</ChangeNote>
							</ChangeGroup>
							<ChangeGroup kind="drop" tag="삭제" title="동영상 주소" identifier="videoUrl">
								<RadioGroup aria-label="동영상 주소 값" value="drop" height="md">
									<RadioItem
										value="move"
										label="다른 필드로 옮기기"
										control={<ShownSelect value="필드" size="md" width="fit" />}
									/>
									<RadioItem value="drop" label="값 지우기" hint="12편" />
								</RadioGroup>
								<ChangeNote danger>값이 사라집니다. 되돌릴 수 없습니다.</ChangeNote>
							</ChangeGroup>
							<ChangeGroup kind="drop" tag="삭제" title="미리보기 그림" identifier="poster">
								<RadioGroup aria-label="미리보기 그림 값" value="drop" height="md">
									<RadioItem
										value="move"
										label="다른 필드로 옮기기"
										control={<ShownSelect value="필드" size="md" width="fit" />}
									/>
									<RadioItem value="drop" label="값 지우기" hint="9편" />
								</RadioGroup>
							</ChangeGroup>
						</Stack>
					</SheetBody>
					<SheetFooter>
						<Button variant="ghost">취소</Button>
						<Button variant="danger">지우고 적용</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</AdminFrame>
	);
}

/** 5. A proposal aimed at a field of an option the entry has not chosen: its row says why it cannot be applied, as a row changed meanwhile does. */
export function ConditionalProposalScreen() {
	return (
		<AdminFrame open={null}>
			<PageColumn>
				<TextButton variant="quiet" size="note">
					<ChevronLeft aria-hidden />
					어시스턴트
				</TextButton>
				<Stack gap={0} paddingTop={2}>
					<PageHeader title="제안 검토" meta="11. 13 10:51">
						<Button variant="ghost">버리기</Button>
						<Button>1건 적용</Button>
					</PageHeader>
				</Stack>
				<PageBody>
					<Stack gap={32} paddingTop={16}>
						<Text as="p" variant="title" tone="muted">
							“링크 주소가 빈 글에 주소를 채워 줘.”
						</Text>
						{/* The review page as it is built (screens/assistant.md): a titled list whose rows are the shared table. */}
						<ListSection table title="링크 주소 채우기" count="2건">
							<Table container="none" aria-label="링크 주소 채우기">
								<TableBody>
									<TableRow twoLine>
										<TableCell>
											<Checkbox checked aria-label="읽을거리 모음 넣기" />
										</TableCell>
										<TableCell truncate>
											<Stack gap={8} minWidth={0}>
												<RowTitle title="읽을거리 모음" address="/reading-list" />
												<CompareRows>
													<CompareRow single name="링크 주소" translation={<Ins>https://example.dev/reading</Ins>} />
												</CompareRows>
											</Stack>
										</TableCell>
										<TableCell align="end" />
									</TableRow>
									<TableRow twoLine>
										<TableCell>
											<Checkbox checked={false} readOnly aria-label="발표 영상 넣기" />
										</TableCell>
										<TableCell truncate>
											<Stack gap={8} minWidth={0}>
												<RowTitle title="발표 영상" address="/talk" />
												<CompareRows>
													<CompareRow single name="링크 주소" translation={<Ins>https://example.dev/talk</Ins>} />
												</CompareRows>
											</Stack>
										</TableCell>
										<TableCell align="end">
											<Text variant="note" tone="subtle">
												글 종류가 링크가 아님
											</Text>
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</ListSection>
					</Stack>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}

/** 6. The comparison when the two sides chose different options: the choice is the place that differs, and each side shows its own option's fields. */
export function ConditionalCompareScreen() {
	return (
		<StandalonePage>
			<EntryHeaderBar />
			<Stack gap={0} grow minHeight={0} overflow="y">
				<Compare>
					<CompareSide
						label="내 입력 · 저장 안 됨"
						properties={
							<>
								<CompareProperty label="글 종류" empty="비어 있음">
									<CompareText changed>링크</CompareText>
								</CompareProperty>
								<CompareProperty label="링크 주소" empty="비어 있음">
									<CompareText changed>https://example.dev/reading</CompareText>
								</CompareProperty>
							</>
						}
					>
						<CompareTitle>첫 번째 글</CompareTitle>
						<CompareBody>
							<CompareParagraph>블로그를 다시 만들기로 한 건 도구를 고치는 시간이 길어졌기 때문이다.</CompareParagraph>
						</CompareBody>
					</CompareSide>
					<CompareSide
						label="서버 최신본 · v4 · 10:41 저장"
						properties={
							<>
								<CompareProperty label="글 종류" empty="비어 있음">
									<CompareText changed>동영상</CompareText>
								</CompareProperty>
								<CompareProperty label="동영상 주소" empty="비어 있음">
									<CompareText changed>https://example.dev/talk.mp4</CompareText>
								</CompareProperty>
							</>
						}
					>
						<CompareTitle>첫 번째 글</CompareTitle>
						<CompareBody>
							<CompareParagraph>블로그를 다시 만들기로 한 건 도구를 고치는 시간이 길어졌기 때문이다.</CompareParagraph>
						</CompareBody>
					</CompareSide>
				</Compare>
			</Stack>
		</StandalonePage>
	);
}

function EntryHeaderBar() {
	return (
		<Inline gap={16} justify="between" paddingX={24} paddingY={12}>
			<Inline gap={16} minWidth={0}>
				<TextButton variant="quiet">
					<ChevronLeft aria-hidden />
					편집기로
				</TextButton>
				<Text variant="title">서버 최신본과 비교</Text>
			</Inline>
			<Inline gap={16}>
				<Text variant="note" tone="subtle">
					다른 곳 1
				</Text>
				<Separator orientation="vertical" length="control" flush />
				<TextButton>서버 최신본 불러오기</TextButton>
				<Button>내 입력으로 저장</Button>
			</Inline>
		</Inline>
	);
}
