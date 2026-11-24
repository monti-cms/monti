import { Add, Close, Download, OverflowMenuHorizontal, Renew, Spark } from "../icons";
import {
	Box,
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxCreate,
	ComboboxItem,
	ComboboxList,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Grid,
	IconButton,
	Inline,
	Input,
	LetterMark,
	MenuValue,
	PropertyCover,
	PropertyFile,
	PropertyFileAdd,
	PropertyNote,
	PropertyRow,
	PropertySection,
	PropertyValue,
	SearchPreview,
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	SidePanel,
	Stack,
	Switch,
	Text,
	Textarea,
	TextButton,
	useComboboxAnchor,
} from "../index";
import { TextDoc } from "./editor";
import { DocBody, DocTitle, EditorScreen, EditorStatus, EditorTopBar, LanguageTabs } from "./editor-frame";

/** 표지에 쓰는 지어낸 그림: 모래빛 비탈(시안 `panel-states.html`의 그러데이션). */
const DUNE = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9cfbd"/><stop offset="1" stop-color="#a99c86"/></linearGradient></defs><rect width="160" height="90" fill="url(#g)"/></svg>`,
)}`;

const TOPICS = [
	{ value: "guide", label: "안내" },
	{ value: "news", label: "소식" },
	{ value: "thought", label: "생각" },
];

/** 고르기 칸 하나(주제 · 계절 · 연재): 쉴 때는 글자, 포인터 · 포커스 · 열림에 밑줄과 갈매기. */
function PickField({
	label,
	items,
	value,
	placeholder = "선택",
	open,
	create,
}: {
	label: string;
	items: readonly { value: string; label: string }[];
	value?: string;
	placeholder?: string;
	/** 목록이 열려 있다(시안의 한 장면). */
	open?: boolean;
	/** 목록 끝의 "+ 새 …" 행. */
	create?: string;
}) {
	return (
		<Select items={items} defaultValue={value ?? null} defaultOpen={open} modal={false}>
			<SelectTrigger size="md" width="full" caret="active" aria-label={label}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			{/* 시안처럼 목록이 칸의 상자와 같은 폭으로 칸 아래 3px에 선다. */}
			<SelectContent width="field" sideOffset={3}>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
				{create && (
					<>
						<SelectSeparator />
						<SelectItem value="__new">
							<Add aria-hidden />
							{create}
						</SelectItem>
					</>
				)}
			</SelectContent>
		</Select>
	);
}

/** 태그 칸: 고른 태그가 칩으로 서고 그 뒤에 치는 자리. `typed`가 있으면 그 글자로 찾는 목록이 열려 있다. */
function TagField({
	label,
	tags,
	placeholder = "태그 추가",
	typed,
	more,
}: {
	label: string;
	tags: readonly string[];
	placeholder?: string;
	typed?: string;
	/** 칩으로 다 보이지 않는 나머지 수("+11"). */
	more?: number;
}) {
	const anchor = useComboboxAnchor();
	const found = [
		{ value: "사막", head: "사", tail: "막", count: "3편" },
		{ value: "사진", head: "사", tail: "진", count: "5편" },
		{ value: "여행사진", before: "여행", head: "사", tail: "진", count: "1편" },
	];
	return (
		<Combobox
			items={found.map((each) => each.value)}
			multiple
			defaultValue={[...tags]}
			defaultInputValue={typed}
			defaultOpen={typed !== undefined}
			modal={false}
		>
			<ComboboxChips ref={anchor} size="md">
				{tags.map((tag) => (
					<ComboboxChip key={tag}>{tag}</ComboboxChip>
				))}
				{more ? (
					<TextButton size="caption" variant="quiet">
						+{more}
					</TextButton>
				) : null}
				<ComboboxChipsInput aria-label={label} placeholder={tags.length ? undefined : placeholder} />
			</ComboboxChips>
			{typed !== undefined && (
				<ComboboxContent anchor={anchor} sideOffset={3}>
					<ComboboxList>
						{found.map((each) => (
							<ComboboxItem key={each.value} value={each.value}>
								<span>
									{each.before}
									<b>{each.head}</b>
									{each.tail}
								</span>
								<MenuValue>{each.count}</MenuValue>
							</ComboboxItem>
						))}
						<ComboboxCreate value={`new:${typed}`}>{`‘${typed}’ 새 태그 만들기`}</ComboboxCreate>
					</ComboboxList>
				</ComboboxContent>
			)}
		</Combobox>
	);
}

/** 주소(mono) 칸과 끝의 "제목으로 만들기". */
function SlugField({ value, placeholder }: { value?: string; placeholder?: string }) {
	return (
		<Input
			size="md"
			mono
			aria-label="주소"
			defaultValue={value}
			placeholder={placeholder}
			action={
				<IconButton label="제목으로 만들기" disabled={!value}>
					<Renew aria-hidden />
				</IconButton>
			}
		/>
	);
}

/** 첨부 파일 한 줄의 ⋯ 메뉴: 바꾸기, 내려받기 | 제거. */
function FileMenu({ name, open }: { name: string; open?: boolean }) {
	return (
		<DropdownMenu defaultOpen={open} modal={false}>
			<DropdownMenuTrigger
				render={
					<IconButton label={`${name} 메뉴`}>
						<OverflowMenuHorizontal aria-hidden />
					</IconButton>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuItem>
					<Renew aria-hidden />
					바꾸기
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Download aria-hidden />
					내려받기
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<Close aria-hidden />
					제거
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** "+ 파일 추가"(첨부 파일의 마지막 줄), 끝에 남은 파일 수. */
function AddFile({ rest }: { rest?: string }) {
	return <PropertyFileAdd rest={rest}>파일 추가</PropertyFileAdd>;
}

/** 속성 패널: 머리 "속성"과 ×, 그 아래 절들. */
function Panel({ fill = false, children }: { fill?: boolean; children: React.ReactNode }) {
	return (
		<SidePanel title="속성" width={fill ? "fill" : "side"} bleed closable>
			{children}
		</SidePanel>
	);
}

/** 시안 `panel.html`의 패널: 기본(부제 ✦), 분류(주제 목록이 열림), 미디어(빈 표지), 접힌 관계 · 형식 · 검색·공유. */
export function MainPanel() {
	return (
		<Panel>
			<PropertySection title="기본">
				<PropertyRow label="주소">
					<SlugField value="examples-text" />
				</PropertyRow>
				<PropertyRow label="요약">
					<Textarea size="md" aria-label="요약" defaultValue="제목, 서식, 링크, 목록, 인용." />
				</PropertyRow>
				<PropertyRow label="부제">
					<Input
						size="md"
						aria-label="부제"
						placeholder="부제 쓰기"
						action={
							<IconButton tone="proposal" label="부제 쓰기">
								<Spark aria-hidden />
							</IconButton>
						}
					/>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="분류">
				<PropertyRow label="주제">
					<PickField label="주제" items={TOPICS} value="guide" open create="새 주제" />
				</PropertyRow>
				<PropertyRow label="계절">
					<PickField label="계절" items={[{ value: "spring", label: "봄" }]} />
				</PropertyRow>
				<PropertyRow label="연재">
					<PickField label="연재" items={[{ value: "type", label: "글자 다루기" }]} />
				</PropertyRow>
				<PropertyRow label="태그">
					<TagField label="태그" tags={["글자", "서식"]} />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="미디어">
				<PropertyRow label="표지">
					<Stack gap={0} paddingTop={4}>
						<PropertyCover placeholder="이미지 고르기 · 끌어 놓기" />
						<PropertyNote>1200×630 이상 · JPG·PNG·WebP</PropertyNote>
					</Stack>
				</PropertyRow>
				<PropertyRow label="첨부 파일">
					<AddFile />
				</PropertyRow>
			</PropertySection>
			<PropertySection
				title="관계"
				need
				needLabel="발행 전에 고칠 것"
				summary="글쓴이 없음 · 관련 글 0"
				defaultOpen={false}
			/>
			<PropertySection title="형식" summary="글 · 고정 안 함" defaultOpen={false} />
			<PropertySection title="검색·공유" summary="제목·요약을 그대로 씀" defaultOpen={false} />
		</Panel>
	);
}

/** ① 새 글: 빈 값, 필수(주제) 빠짐. */
function NewPanel() {
	return (
		<Panel fill>
			<PropertySection title="기본">
				<PropertyRow label="주소">
					<SlugField placeholder="제목을 쓰면 채워짐" />
				</PropertyRow>
				<PropertyRow label="요약">
					<Textarea size="md" aria-label="요약" placeholder="요약 쓰기" />
				</PropertyRow>
				<PropertyRow label="부제">
					<Input size="md" aria-label="부제" placeholder="부제 쓰기" />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="분류" need needLabel="발행 전에 고칠 것">
				<PropertyRow label="주제">
					<PickField label="주제" items={TOPICS} placeholder="발행 전에 고르기" />
				</PropertyRow>
				<PropertyRow label="계절">
					<PickField label="계절" items={[{ value: "spring", label: "봄" }]} />
				</PropertyRow>
				<PropertyRow label="연재">
					<PickField label="연재" items={[{ value: "type", label: "글자 다루기" }]} />
				</PropertyRow>
				<PropertyRow label="태그">
					<TagField label="태그" tags={[]} />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="미디어">
				<PropertyRow label="표지">
					<Stack gap={0} paddingTop={4} paddingBottom={4}>
						<PropertyCover placeholder="이미지 고르기 · 끌어 놓기" />
					</Stack>
				</PropertyRow>
				<PropertyRow label="첨부 파일">
					<AddFile />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="관계" summary="비어 있음" defaultOpen={false} />
			<PropertySection title="형식" summary="글 · 고정 안 함" defaultOpen={false} />
			<PropertySection title="검색·공유" summary="제목·요약을 그대로 씀" defaultOpen={false} />
		</Panel>
	);
}

/** ② 채운 값: 요약을 쓰는 중, 첨부 파일의 ⋯ 메뉴가 열림. */
function FilledPanel() {
	return (
		<Panel fill>
			<PropertySection title="기본">
				<PropertyRow label="주소">
					<SlugField value="examples-text" />
				</PropertyRow>
				<PropertyRow label="요약">
					<Textarea
						size="md"
						aria-label="요약"
						data-autofocus=""
						defaultValue="제목, 서식, 링크, 목록, 인용을 한 글에서 모두 써 봅니다."
					/>
					<PropertyNote align="end">38/160</PropertyNote>
				</PropertyRow>
				<PropertyRow label="부제">
					<Input size="md" aria-label="부제" defaultValue="글자 역할 한눈에 보기" />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="분류">
				<PropertyRow label="주제">
					<PickField label="주제" items={TOPICS} value="guide" />
				</PropertyRow>
				<PropertyRow label="계절">
					<PickField label="계절" items={[{ value: "spring", label: "봄" }]} value="spring" />
				</PropertyRow>
				<PropertyRow label="연재">
					<PickField label="연재" items={[{ value: "type", label: "글자 다루기" }]} value="type" />
				</PropertyRow>
				<PropertyRow label="태그">
					<TagField label="태그" tags={["글자", "서식", "목록"]} />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="미디어">
				<PropertyRow label="표지">
					<Stack gap={0} paddingTop={4}>
						<PropertyCover
							src={DUNE}
							placeholder="이미지 고르기 · 끌어 놓기"
							action={
								<IconButton label="표지 메뉴">
									<OverflowMenuHorizontal aria-hidden />
								</IconButton>
							}
						/>
						<PropertyNote>사막-밤.jpg · 1600×900</PropertyNote>
					</Stack>
				</PropertyRow>
				<PropertyRow label="첨부 파일">
					<Stack gap={0}>
						<PropertyFile name="안내서.pdf" size="2.1MB" action={<FileMenu name="안내서.pdf" open />} />
						<PropertyFile
							name="2026-가을-걷기-길-백과-지역별-지도-최종본-v3-수정.pdf"
							size="18.4MB"
							action={<FileMenu name="2026-가을-걷기-길-백과-지역별-지도-최종본-v3-수정.pdf" />}
						/>
						<PropertyFile name="준비물.csv" size="4KB" action={<FileMenu name="준비물.csv" />} />
						<AddFile />
					</Stack>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="관계" summary="김하늘 · 관련 글 2" defaultOpen={false} />
			<PropertySection title="형식" summary="글 · 고정 안 함" defaultOpen={false} />
		</Panel>
	);
}

/** ③ 태그 고르기: "사"를 쳐서 찾는 목록이 열림. */
function TagPickPanel() {
	return (
		<Panel fill>
			<PropertySection title="기본" summary="examples-text" defaultOpen={false} />
			<PropertySection title="분류">
				<PropertyRow label="주제">
					<PickField label="주제" items={TOPICS} value="guide" />
				</PropertyRow>
				<PropertyRow label="계절">
					<PickField label="계절" items={[{ value: "spring", label: "봄" }]} value="spring" />
				</PropertyRow>
				<PropertyRow label="연재">
					<PickField label="연재" items={[{ value: "type", label: "글자 다루기" }]} />
				</PropertyRow>
				<PropertyRow label="태그">
					<TagField label="태그" tags={["글자", "서식"]} typed="사" />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="미디어">
				<PropertyRow label="표지">
					<Stack gap={0} paddingTop={4} paddingBottom={4}>
						<PropertyCover placeholder="이미지 고르기 · 끌어 놓기" />
					</Stack>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="관계" summary="김하늘 · 관련 글 2" defaultOpen={false} />
		</Panel>
	);
}

/** ④ 관계 · 형식 · 검색·공유를 펼침, 대표 주소에 입력 오류. */
function RelationsPanel() {
	return (
		<Panel fill>
			<PropertySection title="기본" summary="examples-text" defaultOpen={false} />
			<PropertySection title="분류" summary="안내 · 태그 2" defaultOpen={false} />
			<PropertySection title="관계">
				<PropertyRow label="글쓴이">
					<PropertyValue>
						<LetterMark>김</LetterMark>
						김하늘
					</PropertyValue>
				</PropertyRow>
				<PropertyRow label="관련 글">
					<PropertyValue stacked>
						<span>
							사막의 밤하늘{" "}
							<Text variant="caption" tone="faint">
								· 11월 14일
							</Text>
						</span>
						<span>
							<Text tone="faint">제목 없음</Text>{" "}
							<Text variant="caption" tone="faint">
								· 초안 · 11월 14일
							</Text>
						</span>
					</PropertyValue>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="형식">
				<PropertyRow label="형식">
					<PropertyValue stacked>
						<span>글</span>
						<Text variant="caption" tone="faint">
							본문 중심 · 표지는 위에 크게
						</Text>
					</PropertyValue>
				</PropertyRow>
				<PropertyRow label="맨 위 고정">
					<PropertyValue end={<Switch aria-label="맨 위 고정" />}>목록 맨 위에 보이기</PropertyValue>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="검색·공유" need needLabel="발행 전에 고칠 것">
				<SearchPreview
					title="보기 모음 · 글자와 목록"
					url="monti.site › articles › examples-text"
					description="제목, 서식, 링크, 목록, 인용."
				/>
				<PropertyRow label="검색 제목">
					<Input
						size="md"
						aria-label="검색 제목"
						placeholder="글 제목을 씀"
						action={
							<Text variant="caption" tone="faint" mono>
								0/60
							</Text>
						}
					/>
				</PropertyRow>
				<PropertyRow label="검색 설명">
					<Input
						size="md"
						aria-label="검색 설명"
						placeholder="요약을 씀"
						action={
							<Text variant="caption" tone="faint" mono>
								0/160
							</Text>
						}
					/>
				</PropertyRow>
				<PropertyRow label="검색 숨김">
					<PropertyValue end={<Switch aria-label="검색 숨김" />}>검색 엔진에 안 보이기</PropertyValue>
				</PropertyRow>
				<PropertyRow label="대표 주소">
					<Input size="md" mono aria-label="대표 주소" aria-invalid defaultValue="monti.site/old-text" />
					<PropertyNote tone="danger">https://로 시작하는 주소를 쓰세요</PropertyNote>
				</PropertyRow>
			</PropertySection>
		</Panel>
	);
}

/** 판의 한 단: 위 44px에 이름(13px 600)과 흐린 설명, 그 아래 테두리 친 패널. */
function BoardColumn({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
	return (
		<Stack gap={0} minWidth={0} minHeight={0} overflow="hidden">
			<Box paddingY={4}>
				<Inline gap={8} align="center" height="control-lg">
					<Text variant="note" weight="semibold">
						{name}
					</Text>
					<Text variant="caption" tone="faint">
						{note}
					</Text>
				</Inline>
			</Box>
			<Box grow minHeight={0} paddingBottom={16}>
				{children}
			</Box>
		</Stack>
	);
}

/** 시안 `panel-states.html`: 속성 패널의 네 장면을 나란히. */
export function PanelStatesBoard() {
	return (
		<Text as="div" variant="body">
			<Box background="page" height="screen" paddingX={24}>
				<Grid columns={4} gap={24} height="full">
					<BoardColumn name="① 새 글" note="빈 값 · 필수 빠짐">
						<NewPanel />
					</BoardColumn>
					<BoardColumn name="② 채운 값" note="마우스 올림 · 입력 중">
						<FilledPanel />
					</BoardColumn>
					<BoardColumn name="③ 태그 고르기" note="검색 · 새로 만들기">
						<TagPickPanel />
					</BoardColumn>
					<BoardColumn name="④ 관계·형식·검색" note="펼침 · 입력 오류">
						<RelationsPanel />
					</BoardColumn>
				</Grid>
			</Box>
		</Text>
	);
}

/** 시안 `panel.html`: 편집기 옆에 속성 패널이 열려 있다. */
export function PanelScreen() {
	return (
		<EditorScreen
			top={<EditorTopBar folder="보기 모음" title="보기 모음 · 글자와 목록" publish="published" panelOpen />}
			panel={<MainPanel />}
			status={<EditorStatus save="저장됨" count="730" />}
		>
			<TextDoc />
		</EditorScreen>
	);
}

const LONG_TITLE = "2026년 가을 전국 걷기 길 백과 — 강원·경상·전라·제주의 숨은 산책로 120곳과 계절별 준비물";

/** 시안 `panel-extreme.html`의 패널: 긴 주소 · 요약 · 연재, 많은 태그, 긴 라벨, 많은 첨부 파일과 관련 글. */
function ExtremePanel() {
	return (
		<Panel>
			<PropertySection title="기본">
				<PropertyRow label="주소">
					<SlugField value="2026-autumn-korea-walking-trails-encyclopedia-120" />
				</PropertyRow>
				<PropertyRow label="요약">
					<Textarea
						size="md"
						aria-label="요약"
						defaultValue="강원·경상·전라·제주의 숨은 산책로 120곳을 계절별로 묶고, 길마다 거리·걸리는 시간·준비물·가까운 역과 버스, 쉬어 갈 곳과 화장실 위치까지 한 장에 정리했습니다. 긴 요약은 세 줄까지만 보이고 누르면 다 펼칩니다."
					/>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="분류">
				<PropertyRow label="주제">
					<PickField label="주제" items={TOPICS} value="guide" />
				</PropertyRow>
				<PropertyRow label="연재">
					<PickField
						label="연재"
						items={[{ value: "walk", label: "계절마다 다시 걷는 우리 동네 산책로 이야기 (2024–2026)" }]}
						value="walk"
					/>
				</PropertyRow>
				<PropertyRow label="태그">
					<TagField
						label="태그"
						tags={["걷기", "가을", "강원", "경상", "전라", "제주", "산책로", "준비물", "아주 긴 태그 이름은 잘림…"]}
						more={11}
					/>
				</PropertyRow>
				<PropertyRow label="원문 출처 링크 주소">
					<Input size="md" mono aria-label="원문 출처 링크 주소" placeholder="https://로 시작" />
				</PropertyRow>
			</PropertySection>
			<PropertySection title="미디어" summary="표지 1 · 첨부 24">
				<PropertyRow label="첨부 파일">
					<Stack gap={0}>
						{[
							["2026-가을-걷기-길-백과-강원·경상·전라·제주-지역별-지도-최종본-v3-수정-인쇄용.pdf", "48.2MB"],
							["Trail_Map_GPX_Export_All_Regions_2026-11-14T09-18-00Z.gpx", "912KB"],
							["준비물.csv", "4KB"],
						].map(([name, size]) => (
							<PropertyFile key={name} name={name} size={size} action={<FileMenu name={name} />} />
						))}
						<AddFile rest="외 21개 · 모두 보기" />
					</Stack>
				</PropertyRow>
			</PropertySection>
			<PropertySection title="관계">
				<PropertyRow label="글쓴이">
					<TagField label="글쓴이" tags={["김하늘", "이바다", "박산"]} more={2} />
				</PropertyRow>
				<PropertyRow label="관련 글">
					<PropertyValue stacked>
						<Text truncate>봄 산책 코스 — 서울 둘레길 8코스 완주 기록과 지도</Text>
						<Text truncate>숲길 지도</Text>
						<span>
							<Text tone="faint">제목 없음</Text>{" "}
							<Text variant="caption" tone="faint">
								· 초안
							</Text>
						</span>
						<TextButton size="caption" variant="quiet">
							외 9편 · 모두 보기
						</TextButton>
					</PropertyValue>
				</PropertyRow>
			</PropertySection>
			<PropertySection
				title="검색·공유"
				need
				needLabel="발행 전에 고칠 것"
				summary="검색 제목이 60자를 넘음 (74/60)"
				defaultOpen={false}
			/>
		</Panel>
	);
}

/** 시안 `panel-extreme.html`: 긴 폴더 이름과 제목, 언어 여럿, 긴 값이 한꺼번에 들어간 글. */
export function PanelExtremeScreen() {
	return (
		<EditorScreen
			top={<EditorTopBar folder="아주 긴 폴더 이름이 붙은 연재 모음" title={LONG_TITLE} publish="changes" panelOpen />}
			panel={<ExtremePanel />}
			status={<EditorStatus save="저장 전 변경 있음" todo="할 일 1" todoTone="warning" count="48,210" />}
		>
			<LanguageTabs others={["English", "日本語", "中文", "Español", "+7"]} />
			<DocTitle gap={24}>{LONG_TITLE}</DocTitle>
			<DocBody>
				<p>길이 긴 제목, 많은 태그, 긴 선택값, 긴 라벨, 많은 관련 글이 한꺼번에 들어간 경우입니다.</p>
			</DocBody>
		</EditorScreen>
	);
}
