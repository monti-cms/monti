import type { Meta, StoryObj } from "@storybook/react-vite";
import { Folder, Upload } from "./icons";
import { Button, DropArea, DropEmpty, FolderTile, Grid, Image, Stack, Tile } from "./index";

/** A sample picture: a warm gradient with a sun, drawn inline so the story needs no file. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#c76b4a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="300" r="120" fill="#fff3d6"/><path d="M0 700 L400 480 L800 700 L1200 520 L1600 700 V900 H0 Z" fill="#6b3a2e"/></svg>',
)}`;

/**
 * What files can be dropped on. While files are over it (`over`), an ink line runs along its edge, 12px clear of what it holds, and a 7% ink tint lies over
 * the whole area; a folder the files are over takes `FolderTile dropTarget` instead, and the area's frame goes out.
 */
const meta = {
	title: "Patterns/List/DropArea",
	component: DropArea,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const grid = (folderTarget = false) => (
	<Grid columns="tiles">
		<FolderTile name="covers" count={12} dropTarget={folderTarget} />
		{["cover-2026.png", "spring-desk.jpg", "hero.png"].map((title) => (
			<Tile key={title} preview={<Image src={PHOTO} alt="" ratio="photo" />} title={title} detail="1600×900" />
		))}
	</Grid>
);

/** Files over the area. */
export const Over: Story = { render: () => <DropArea over>{grid()}</DropArea> };

/** Files over a folder in it: the folder is marked, the area is not. */
export const OverFolder: Story = { render: () => <DropArea>{grid(true)}</DropArea> };

/** `flush`: what it holds brings its own room, as a table does. The area adds none, and the line runs on its edge. */
export const Flush: Story = {
	render: () => (
		<DropArea over flush>
			<Stack padding={12}>{grid()}</Stack>
		</DropArea>
	),
};

/** `fill`: the area takes the column's remaining height, so a page with few files can be dropped on to its end. */
export const Fill: Story = {
	tags: ["visual"],
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", height: 480 }}>
			<DropArea fill over>
				{grid()}
			</DropArea>
		</div>
	),
};

/** An empty folder: the frame files are dropped on, with what can go in and two ways to begin (2026-11 redesign, `media-empty.html`). */
export const Empty: Story = {
	render: () => (
		<DropEmpty
			icon={<Upload aria-hidden />}
			title="이 폴더는 비어 있습니다"
			hint="파일을 여기에 끌어 놓거나 올리기를 누르세요 · 이미지·PDF·CSV, 한 파일 50MB까지"
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
	),
};
