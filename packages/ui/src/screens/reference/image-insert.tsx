import { FolderTile, Image, MediaPicker, StatusBar, StatusBarCell, StatusBarSpacer, Tile } from "../../index";
import {
	BodyBlock,
	BodyHeading,
	EditorPage,
	EntryHeader,
	EntryProperties,
	EntryTitle,
	LanguageTabs,
	Paragraph,
	still,
} from "./editor-notion";

const FILES = [
	{ name: "desk-morning.jpg", detail: "2400×1600 · 글 1" },
	{ name: "cybersecurity-code.jpg", detail: "1600×900 · 글 2" },
	{ name: "seoul-night.jpg", detail: "3000×2000 · 글 1" },
	{ name: "cafe-window.jpg", detail: "2000×1333 · 글 1" },
	{ name: "winter-02.jpg", detail: "2400×1600" },
	{ name: "hero-dark.png", detail: "2560×1440" },
];

/** Inserting an image: the library open as a picker over the editor, nothing picked yet, so no "넣기" pill until a tile is. */
export function ImageInsertScreen() {
	return (
		<>
			<EditorPage
				header={<EntryHeader address="/posts/first-post" status="draft" statusLabel="초안" />}
				head={<LanguageTabs englishDot />}
				side={<EntryProperties />}
				statusBar={
					<StatusBar>
						<StatusBarCell>저장됨 10:42</StatusBarCell>
						<StatusBarCell tone="warning">할 일 2</StatusBarCell>
						<StatusBarCell>맞춤법 2</StatusBarCell>
						<StatusBarSpacer />
						<StatusBarCell end>1,240자</StatusBarCell>
					</StatusBar>
				}
			>
				<EntryTitle>첫 번째 글</EntryTitle>
				<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
				<BodyBlock gap={32}>
					<BodyHeading>무엇을 덜어냈나</BodyHeading>
				</BodyBlock>
				<BodyBlock gap={12}>
					<Paragraph>
						목록에는 제목과 주소, 지금 상태만 남겼다. <span>나머지는 필요할 때 꺼내 본다</span>.
					</Paragraph>
				</BodyBlock>
				<BodyBlock gap={20}>
					<Paragraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</Paragraph>
				</BodyBlock>
				<BodyBlock gap={20}>
					<Paragraph tone="faint">/ 를 눌러 블록 넣기</Paragraph>
				</BodyBlock>
			</EditorPage>
			<MediaPicker
				open
				onOpenChange={still}
				title="라이브러리"
				topLabel="미디어"
				folders={[
					{ id: "Blog Assets", name: "Blog Assets", depth: 0 },
					{ id: "covers", name: "covers", depth: 1 },
					{ id: "diagrams", name: "diagrams", depth: 1 },
					{ id: "Wallpapers", name: "Wallpapers", depth: 0 },
				]}
				folder="Blog Assets"
				onFolderChange={still}
				foldersLabel="폴더"
				search=""
				onSearchChange={still}
				searchLabel="파일 이름 검색"
				uploadLabel="올리기"
				onUpload={still}
				confirmLabel="넣기"
				onConfirm={still}
				confirmHidden
				subfolders={
					<>
						<FolderTile name="covers" />
						<FolderTile name="diagrams" />
					</>
				}
			>
				{FILES.map((file) => (
					<Tile
						key={file.name}
						preview={<Image src={null} alt="" ratio="photo" radius="none" />}
						title={file.name}
						detail={file.detail}
					/>
				))}
			</MediaPicker>
		</>
	);
}
