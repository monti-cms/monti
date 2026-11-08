import type { Meta, StoryObj } from "@storybook/react-vite";
import { OverflowMenuHorizontal } from "./icons";
import { FilePreview, FolderTile, Grid, IconButton, Image, Tile } from "./index";

/** A sample picture: a warm gradient with a sun, drawn inline so the story needs no file. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#c76b4a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="300" r="120" fill="#fff3d6"/><path d="M0 700 L400 480 L800 700 L1200 520 L1600 700 V900 H0 Z" fill="#6b3a2e"/></svg>',
)}`;

/**
 * A file in a grid: a 4:3 preview, the name over a mono detail line. Flat: no card, no border. Picked: a 2px ink ring and the check on; the file open in
 * a panel has the ring without the check. Uploading, failed and interrupted files say so in the detail line.
 */
const meta = {
	title: "Patterns/List/Tile",
	component: FolderTile,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const picture = <Image src={PHOTO} alt="" ratio="photo" />;
const more = (
	<IconButton label="더 보기">
		<OverflowMenuHorizontal />
	</IconButton>
);
const pick = { onSelectedChange: () => {}, selectLabel: "고르기" };

/** Ready, picked, current (open in the panel), and a file without a picture. */
export const States: Story = {
	render: () => (
		<Grid columns="tiles">
			<TileWith title="cover-2026.png" detail="1600×900 · 글 1" action={more} />
			<TileWith title="spring-desk.jpg" detail="2400×1600 · 글 2" selected picking />
			<TileWith title="hero.png" detail="1920×1080" current />
			<FileTile />
		</Grid>
	),
};

/** Going up, refused (a type the site does not take), and interrupted (too large), with what can be done. */
export const Upload: Story = {
	render: () => (
		<Grid columns="tiles">
			<TileWith title="trip-01.jpg" detail="올리는 중 · 64%" status="uploading" progress={64} />
			<TileWith
				title="clip.mov"
				detail="받지 않는 형식이에요"
				status="failed"
				noPreview
				actions={[{ label: "빼기", onClick: () => {} }]}
			/>
			<TileWith
				title="panorama.png"
				detail="20MB보다 커요"
				status="interrupted"
				actions={[
					{ label: "줄여서 다시", onClick: () => {}, primary: true },
					{ label: "빼기", onClick: () => {} },
				]}
			/>
		</Grid>
	),
};

/** A problem's reason wraps rather than being cut: a reason cut off is no reason. A size or a use is cut. */
export const LongReason: Story = {
	tags: ["visual"],
	render: () => (
		<Grid columns="tiles">
			<TileWith
				title="iphone-photo.heic"
				detail="HEIC는 받지 않아요 · JPEG나 PNG로 바꿔 주세요"
				status="failed"
				noPreview
				actions={[{ label: "빼기", onClick: () => {} }]}
			/>
			<TileWith title="spring-desk.jpg" detail="2400×1600 · 글 2 · 라이브러리에서 아주 오래전에 올린 파일" />
		</Grid>
	),
};

/** The assistant's suggestion in the place of the detail line; a picked tile that has one is ringed in blue. */
export const Proposal: Story = {
	render: () => (
		<Grid columns="tiles">
			<TileWith title="spring-desk.jpg" proposal="✦ 봄 햇살이 드는 책상" selected picking />
			<TileWith title="cover-2026.png" proposal="✦ 노을 진 산" picking />
		</Grid>
	),
};

/** Folders beside the files: a low tile with the icon, name and count; one a menu is open on; one files are dragged over. */
export const Folders: Story = {
	render: () => (
		<Grid columns="tiles">
			<FolderTile name="covers" count={12} action={more} />
			<FolderTile name="trips" count={48} selected />
			<FolderTile name="drafts" count={3} dropTarget />
		</Grid>
	),
};

function TileWith({
	noPreview,
	...props
}: Omit<React.ComponentProps<typeof Tile>, "preview" | "onSelectedChange"> & { noPreview?: boolean }) {
	return <Tile preview={noPreview ? null : picture} {...pick} {...props} />;
}

function FileTile() {
	return <Tile preview={<FilePreview ext="PDF" />} title="annual-report.pdf" detail="PDF · 1.2MB" {...pick} />;
}
