import { FolderParent, Upload } from "../../icons";
import {
	Button,
	DropArea,
	FilePreview,
	FilterButton,
	FolderTile,
	Grid,
	IconButton,
	Image,
	Inline,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	SearchToggle,
	Segmented,
	Stack,
	TextButton,
	Tile,
} from "../../index";
import { AdminFrame, type FrameFolder } from "./frame";

const MEDIA_FOLDERS: readonly FrameFolder[] = [
	{ name: "Blog Assets", count: "14", active: true },
	{ name: "covers", count: "6", depth: 1 },
	{ name: "diagrams", count: "3", depth: 1 },
	{ name: "Wallpapers", count: "7" },
];

/** A sample photo as the board paints it: a 160deg gradient between two colours, as a tiny SVG. */
const sample = (from: string, to: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0.33" y1="0" x2="0.67" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>`,
	)}`;

const FILES: readonly { name: string; detail: string; picture?: string; ext?: string }[] = [
	{ name: "cybersecurity-code.jpg", detail: "1600×900 · 글 2", picture: sample("#2f3a2c", "#121611") },
	{ name: "desk-morning.jpg", detail: "2400×1600 · 글 1", picture: sample("#d8cdb8", "#a69479") },
	{ name: "seoul-night.jpg", detail: "3000×2000 · 글 1", picture: sample("#3a3f55", "#1c1e2b") },
	{ name: "notes-scan.pdf", detail: "PDF · 2.1 MB · 사용 안 함", ext: "PDF" },
	{ name: "cafe-window.jpg", detail: "2000×1333 · 글 1", picture: sample("#b9a184", "#6d5a44") },
];

/** A media folder: the way up, its folders, then its files as tiles. */
export function MediaScreen() {
	return (
		<AdminFrame open="media" folders={MEDIA_FOLDERS}>
			<PageColumn width="list">
				<PageHeader
					trail={
						<Inline as="nav" gap={6} aria-label="경로">
							<TextButton variant="underline">미디어</TextButton>
							<span aria-hidden="true">/</span>
						</Inline>
					}
					title="Blog Assets"
				>
					<TextButton>+ 폴더</TextButton>
					<SearchToggle label="검색" value="" aria-label="검색" />
					<Button variant="primary">
						<Upload aria-hidden />
						올리기
					</Button>
				</PageHeader>
				<PageToolbar inset>
					<FilterButton>종류</FilterButton>
					<FilterButton>사용 여부</FilterButton>
					<FilterButton>대체 텍스트</FilterButton>
					<PageToolbarEnd>
						<FilterButton>최근 올린순</FilterButton>
						<Segmented
							aria-label="보기"
							size="sm"
							inline
							value="grid"
							onValueChange={() => {}}
							options={[
								{ value: "grid", label: "격자" },
								{ value: "list", label: "목록" },
							]}
						/>
					</PageToolbarEnd>
				</PageToolbar>
				<DropArea>
					<Stack gap={24} paddingTop={24} paddingX={12}>
						<Grid columns="folders">
							<FolderTile name="상위 폴더로" icon={<FolderParent aria-hidden />} />
							<FolderTile name="covers" count={6} />
							<FolderTile name="diagrams" count={3} />
						</Grid>
						<Grid columns="tiles">
							{FILES.map((file) => (
								<Tile
									key={file.name}
									title={file.name}
									detail={file.detail}
									action={<IconButton label="더 보기">⋯</IconButton>}
									onSelectedChange={() => {}}
									selectLabel={`${file.name} 고르기`}
									preview={
										file.ext ? (
											<FilePreview ext={file.ext} />
										) : (
											<Image src={file.picture} alt="" ratio="photo" radius="none" />
										)
									}
								/>
							))}
						</Grid>
					</Stack>
				</DropArea>
			</PageColumn>
		</AdminFrame>
	);
}
