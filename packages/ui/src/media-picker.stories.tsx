import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FilePreview, Image, MediaPicker, Tile } from "./index";

/** A sample picture: a warm gradient with a sun, drawn inline so the story needs no file. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#c76b4a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="300" r="120" fill="#fff3d6"/><path d="M0 700 L400 480 L800 700 L1200 520 L1600 700 V900 H0 Z" fill="#6b3a2e"/></svg>',
)}`;

/**
 * The library as a picker: a 760px modal, the folders at the left (the top entry for all, sub-folders indented, counts in mono), a search box and three
 * columns of tiles, "Upload" at the bottom left, Cancel and the one pill at the bottom right.
 */
const meta = {
	title: "Patterns/Sheet/MediaPicker",
	parameters: { bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const FOLDERS = [
	{ id: "covers", name: "covers", depth: 0, count: 12 },
	{ id: "trips", name: "trips", depth: 0, count: 48 },
	{ id: "trips-jeju", name: "jeju", depth: 1, count: 9 },
];

function Picker({ files = false }: { files?: boolean }) {
	const [picked, setPicked] = useState<string | null>("b");
	const [folder, setFolder] = useState<string | null>(null);
	const items = files
		? [
				{ id: "a", title: "annual-report.pdf", detail: "PDF · 1.2MB", ext: "PDF" },
				{ id: "b", title: "price-list.csv", detail: "CSV · 18KB", ext: "CSV" },
			]
		: [
				{ id: "a", title: "cover-2026.png", detail: "1600×900" },
				{ id: "b", title: "spring-desk.jpg", detail: "2400×1600" },
				{ id: "c", title: "hero.png", detail: "1920×1080" },
				{ id: "d", title: "trip-01.jpg", detail: "4032×3024" },
			];
	return (
		<MediaPicker
			open
			onOpenChange={() => {}}
			title={files ? "파일 넣기" : "이미지 넣기"}
			allLabel={files ? "모든 파일" : "모든 이미지"}
			folders={FOLDERS}
			folder={folder}
			onFolderChange={setFolder}
			foldersLabel="폴더"
			search=""
			onSearchChange={() => {}}
			searchLabel="찾기"
			uploadLabel="올리기"
			onUpload={() => {}}
			confirmLabel="넣기"
			onConfirm={() => {}}
			confirmDisabled={picked === null}
		>
			{items.map((item) => (
				<Tile
					key={item.id}
					preview={"ext" in item ? <FilePreview ext={String(item.ext)} /> : <Image src={PHOTO} alt="" ratio="photo" />}
					title={item.title}
					detail={item.detail}
					selected={picked === item.id}
					picking={picked !== null}
					onSelectedChange={(on) => setPicked(on ? item.id : null)}
					selectLabel={`${item.title} 고르기`}
				/>
			))}
		</MediaPicker>
	);
}

/** Images, one picked. */
export const Images: Story = { render: () => <Picker /> };

/** Files: tiles with a file preview. */
export const Files: Story = { render: () => <Picker files /> };
