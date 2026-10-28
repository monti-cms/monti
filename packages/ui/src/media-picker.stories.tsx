import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FilePreview } from "./file-preview";
import { Image } from "./image";
import { MediaPicker } from "./media-picker";
import { Tile } from "./tile";

const sample = (from: string, to: string) =>
	`data:image/svg+xml;utf8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/></svg>`,
	)}`;

const IMAGES = [
	{ name: "desk-morning.jpg", meta: "2400×1600 · 글 1", src: sample("#d8cdb8", "#a69479") },
	{ name: "cybersecurity-code.jpg", meta: "1600×900 · 글 2", src: sample("#2f3a2c", "#121611") },
	{ name: "seoul-night.jpg", meta: "3000×2000 · 글 1", src: sample("#3a3f55", "#1c1e2b") },
	{ name: "cafe-window.jpg", meta: "2000×1333 · 글 1", src: sample("#b9a184", "#6d5a44") },
	{ name: "winter-02.jpg", meta: "2400×1600", src: sample("#cfd8de", "#8fa3b0") },
	{ name: "hero-dark.png", meta: "2560×1440", src: sample("#3d3a33", "#191814") },
];
const FILES = [
	{ name: "price-list-2026.pdf", meta: "PDF · 1.2 MB", ext: "PDF" },
	{ name: "notes-scan.pdf", meta: "PDF · 2.1 MB · 글 1", ext: "PDF" },
	{ name: "subscribers.csv", meta: "CSV · 48 KB", ext: "CSV" },
	{ name: "sample-code.zip", meta: "ZIP · 640 KB", ext: "ZIP" },
	{ name: "changelog.md", meta: "MD · 12 KB", ext: "MD" },
];
const FOLDERS = [
	{ id: "blog", name: "Blog Assets", depth: 0, count: 14 },
	{ id: "covers", name: "covers", depth: 1, count: 6 },
	{ id: "diagrams", name: "diagrams", depth: 1, count: 3 },
	{ id: "wall", name: "Wallpapers", depth: 0, count: 8 },
];

function Picker({
	title,
	confirmLabel,
	allLabel,
	files = false,
	counts = true,
}: {
	title: string;
	confirmLabel: string;
	allLabel: string;
	files?: boolean;
	counts?: boolean;
}) {
	const [folder, setFolder] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [picked, setPicked] = useState(0);
	const items = files ? FILES : IMAGES;
	return (
		<MediaPicker
			open
			onOpenChange={() => {}}
			title={title}
			allLabel={allLabel}
			folders={counts ? FOLDERS : FOLDERS.map(({ count: _count, ...rest }) => rest)}
			folder={folder}
			onFolderChange={setFolder}
			foldersLabel="폴더"
			search={search}
			onSearchChange={setSearch}
			searchLabel="파일 이름 검색"
			uploadLabel="올리기"
			onUpload={() => {}}
			confirmLabel={confirmLabel}
			onConfirm={() => {}}
		>
			{items.map((item, index) => (
				<Tile
					key={item.name}
					selected={picked === index}
					onClick={() => setPicked(index)}
					title={item.name}
					detail={item.meta}
					preview={
						"ext" in item ? <FilePreview ext={item.ext} /> : <Image src={item.src} alt="" ratio="photo" radius="none" />
					}
				/>
			))}
		</MediaPicker>
	);
}

/**
 * The library as a picker: a 760px modal with the folders at the left, search and three columns of tiles at the right. "Upload" is a text button at
 * the bottom left; choosing a tile and pressing the pill puts the file in at once. The same dialog serves images to insert, a cover image and files.
 */
const meta = {
	title: "Patterns/List/MediaPicker",
	component: Picker,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Picker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Library: Story = { args: { title: "라이브러리", confirmLabel: "넣기", allLabel: "모든 이미지" } };

export const CoverImage: Story = { args: { title: "대표 이미지", confirmLabel: "고르기", allLabel: "모든 이미지" } };

/** Files only. The folder counts are left out: they count every kind of file. */
export const Files: Story = {
	args: { title: "파일", confirmLabel: "넣기", allLabel: "모든 파일", files: true, counts: false },
};
