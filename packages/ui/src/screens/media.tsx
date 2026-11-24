import { Folder, Grid as GridIcon, ListBulleted, Search, Upload } from "../icons";
import {
	Box,
	Button,
	DropEmpty,
	FilePreview,
	FilterButton,
	FilterChip,
	FolderTile,
	Grid,
	Image,
	ListFooter,
	ListFooterEnd,
	PageColumn,
	PageHeader,
	PagePath,
	PageToolbar,
	PageToolbarEnd,
	Segmented,
	Text,
	TextButton,
	Tile,
} from "../index";
import { MEDIA_FOLDERS, Num, ScreenFrame } from "./frame";
import { MediaPanel, SUN } from "./media-panel";

/** 시안의 그림: 두 색을 가르거나 잇는 작은 SVG(지어낸 자료). */
const split = (top: string, bottom: string, at: number) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3" preserveAspectRatio="none"><rect width="4" height="3" fill="${bottom}"/><rect width="4" height="${(3 * at) / 100}" fill="${top}"/></svg>`,
	)}`;
const diagonal = (from: string, to: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="4" height="3" fill="url(#g)"/></svg>`,
	)}`;

type MediaFile = { name: string; detail: React.ReactNode; picture?: string; current?: boolean };

/** 시안 `media.html`의 파일. */
const FILES: readonly MediaFile[] = [
	{
		name: "review-drag-harbor.png",
		detail: <>960×600 · 안 쓰임</>,
		picture: split("#cfe0ec", "#35617f", 55),
	},
	{
		name: "review-square-renamed.png",
		detail: <>800×800 · 안 쓰임</>,
		picture: SUN,
		current: true,
	},
	{
		name: "아주-긴-파일-이름을-가진-테스트-사진-2400x1600.jpg",
		detail: (
			<>
				2400×1600 · 글 <Num>3</Num>
			</>
		),
		picture: diagonal("#cdbf9c", "#55704f"),
	},
	{
		name: "review.csv",
		detail: <>CSV · 8바이트 · 안 쓰임</>,
	},
	{
		name: "쓰지 않는 그림.png",
		detail: <>480×320 · 안 쓰임</>,
		picture: split("#ececec", "#7a7a7a", 60),
	},
];

/** 머리 줄 아래의 거르기 줄: 종류 · 쓰임 · 폴더, 끝에 정렬과 보기. */
function FilterRow({ kind }: { kind?: string }) {
	return (
		<PageToolbar size="head">
			{kind ? (
				<FilterChip name="종류" value={kind} named clearLabel="종류 필터 지우기" />
			) : (
				<FilterButton size="caption">종류</FilterButton>
			)}
			<FilterButton size="caption">쓰임</FilterButton>
			<FilterButton size="caption">폴더</FilterButton>
			<PageToolbarEnd>
				<FilterButton size="caption" sort="desc">
					올린 날
				</FilterButton>
				<Segmented
					aria-label="보기"
					size="sm"
					icons
					value="grid"
					onValueChange={() => {}}
					options={[
						{ value: "grid", label: <GridIcon aria-hidden />, "aria-label": "격자" },
						{ value: "list", label: <ListBulleted aria-hidden />, "aria-label": "목록" },
					]}
				/>
			</PageToolbarEnd>
		</PageToolbar>
	);
}

/** 검색과 하나뿐인 검은 알약 "올리기". */
function Actions() {
	return (
		<>
			<Button variant="ghost">
				<Search aria-hidden />
				검색
			</Button>
			<Button>
				<Upload aria-hidden />
				올리기
			</Button>
		</>
	);
}

/** 시안 `media.html`: 최상위의 폴더 셋과 파일 다섯(종류 필터가 켜짐), 연 파일이 오른쪽 패널에. */
export function MediaScreen() {
	return (
		<ScreenFrame open="media" folders={MEDIA_FOLDERS} panel={<MediaPanel />}>
			<PageColumn width="full">
				<PageHeader
					layout="bar"
					title="미디어"
					note={
						<>
							파일 <Num>6</Num>{" "}
							<Text tone="disabled">
								/ <Num>9</Num>
							</Text>{" "}
							· 폴더 <Num>3</Num>
						</>
					}
				>
					<Actions />
				</PageHeader>
				<FilterRow kind="이미지" />
				<Grid columns="media" responsive={false} paddingTop={16}>
					{MEDIA_FOLDERS.map((folder) => (
						<FolderTile key={folder.name} name={folder.name} count={Number(folder.count)} />
					))}
					<Box />
					{FILES.map((file) => (
						<Tile
							key={file.name}
							title={file.name}
							detail={file.detail}
							current={file.current}
							preview={file.picture ? <Image src={file.picture} alt="" ratio="photo" radius="none" /> : <FilePreview />}
						/>
					))}
				</Grid>
				<ListFooter layout="bar">
					<Text variant="caption" tone="subtle">
						파일 <Num>6</Num> / <Num>9</Num>
					</Text>
					<ListFooterEnd>
						<Text variant="caption" tone="subtle">
							필터 <Num>1</Num>개 ·{" "}
							<TextButton variant="underline" size="caption">
								모두 지우기
							</TextButton>
						</Text>
					</ListFooterEnd>
				</ListFooter>
			</PageColumn>
		</ScreenFrame>
	);
}

const LONG_FOLDER = "2026 가을 걷기 길 백과 — 지역별 대표 사진 (강원·경상·전라·제주)";

/**
 * 빈 폴더(시안 `media-empty.html`, `media-deep.html`): 제목 줄이 폴더까지의 길이고, 깊은 폴더는 가운데를 ⋯로 접는다(`deep`, 그 메뉴가 열려 있다).
 * 목록 자리는 파일을 끌어 놓는 빈 틀이다.
 */
export function MediaEmptyScreen({ deep = false }: { deep?: boolean }) {
	return (
		<ScreenFrame open="media" folders={MEDIA_FOLDERS}>
			<PageColumn width="full">
				<PageHeader
					layout="bar"
					title={
						deep ? (
							<PagePath
								trail={[{ name: "미디어" }, { name: "지역별" }]}
								hidden={[{ name: "표지" }, { name: "2026" }, { name: "가을 걷기" }]}
								hiddenLabel="상위 폴더"
								defaultOpen
								current={LONG_FOLDER}
							/>
						) : (
							<PagePath trail={[{ name: "미디어" }, { name: "표지" }]} current={LONG_FOLDER} />
						)
					}
					note="비어 있음"
				>
					<Actions />
				</PageHeader>
				<FilterRow />
				<DropEmpty
					icon={<Upload aria-hidden />}
					title="이 폴더는 비어 있습니다"
					hint={<>파일을 여기에 끌어 놓거나 올리기를 누르세요 · 이미지·PDF·CSV, 한 파일 50MB까지</>}
					actions={
						<>
							<Button variant="secondary" size="sm">
								<Upload aria-hidden />
								파일 고르기
							</Button>
							<Button variant="ghost" size="sm">
								<Folder aria-hidden />
								하위 폴더 만들기
							</Button>
						</>
					}
				/>
			</PageColumn>
		</ScreenFrame>
	);
}
