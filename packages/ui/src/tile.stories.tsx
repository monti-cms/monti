import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, FolderUp, Image as ImageGlyph, MoreHorizontal, Table2, Type } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DropArea } from "./drop-area";
import { IconButton } from "./icon-button";
import { Image } from "./image";
import { RenameField } from "./rename-field";
import { Stack } from "./stack";
import { Text } from "./text";
import { ChoiceCard, FolderTile, Tile } from "./tile";

/** An inline SVG, so the stories load nothing from the network. */
const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#8fb8de"/><circle cx="240" cy="50" r="24" fill="#f6d365"/><path d="M0 180V120l80-50 70 60 60-40 110 70v20z" fill="#4c7a5a"/></svg>',
)}`;

const preview = <Image src={SAMPLE} alt="" ratio="photo" radius="none" />;

/**
 * A file in the media grid: a 4:3 preview, the name, a mono detail line. No card. The check shows in the corner while the pointer is on the
 * tile, a ring marks a picked one, and uploading, failed and suggested files have their own looks.
 */
const meta = {
	title: "List/Tile",
	component: Tile,
	args: {
		preview,
		title: "desk-morning.jpg",
		detail: "2400×1600 · 글 1",
		onSelectedChange: () => {},
		selectLabel: "선택",
	},
	decorators: [
		(Story) => (
			<div className="w-48">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Tile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Labelled({ name, children }: { name: string; children: ReactNode }) {
	return (
		<Stack gap={4}>
			<Text variant="label" tone="muted">
				{name}
			</Text>
			<div className="w-48">{children}</div>
		</Stack>
	);
}

/** Ready, picked, and picked while others are picked (`picking`: every tile shows its check, faint). */
export const Picked: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			<Labelled name="ready">
				<Tile preview={preview} title="desk-morning.jpg" detail="2400×1600 · 글 1" onSelectedChange={() => {}} />
			</Labelled>
			<Labelled name="picked">
				<Tile
					preview={preview}
					title="desk-morning.jpg"
					detail="2400×1600 · 글 1"
					selected
					onSelectedChange={() => {}}
				/>
			</Labelled>
			<Labelled name="picking (others picked)">
				<Tile preview={preview} title="notes.png" detail="1200×800" picking onSelectedChange={() => {}} />
			</Labelled>
		</Stack>
	),
};

/** Uploading: faded preview and a bar along its bottom edge; waiting has no bar. Failed: a red edge and line, and what can be done. */
export const UploadingAndFailed: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			<Labelled name="uploading">
				<Tile preview={preview} title="hero.png" detail="올리는 중 · 64%" status="uploading" progress={64} />
			</Labelled>
			<Labelled name="waiting">
				<Tile preview={preview} title="hero-dark.png" detail="대기" status="uploading" />
			</Labelled>
			<Labelled name="failed">
				<Tile
					preview={preview}
					title="panorama.jpg"
					detail="14 MB · 10 MB까지"
					status="failed"
					actions={[
						{ label: "줄여서 다시", onClick: () => {}, primary: true },
						{ label: "빼기", onClick: () => {} },
					]}
				/>
			</Labelled>
			<Labelled name="failed, no way to retry">
				<Tile
					preview={<Image src={null} alt="" fallback={FileText} ratio="photo" radius="none" />}
					title="IMG_2041.HEIC"
					detail="올릴 수 없는 형식"
					status="failed"
					actions={[{ label: "빼기", onClick: () => {} }]}
				/>
			</Labelled>
		</Stack>
	),
};

/** The assistant's suggestion for the file sits in the detail's place in the proposal mark; picked, the ring and the check are blue. */
export const Proposal: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			<Labelled name="proposal">
				<Tile
					preview={preview}
					title="desk-morning.jpg"
					proposal="아침 책상 위의 노트북과 커피"
					onSelectedChange={() => {}}
				/>
			</Labelled>
			<Labelled name="proposal, picked">
				<Tile
					preview={preview}
					title="desk-morning.jpg"
					proposal="아침 책상 위의 노트북과 커피"
					selected
					onSelectedChange={() => {}}
				/>
			</Labelled>
		</Stack>
	),
};

/** `action` is the ⋯ at the top right, shown with the pointer (point at the tile). */
export const WithMenu: Story = {
	render: () => (
		<Labelled name="action">
			<Tile
				preview={preview}
				title="desk-morning.jpg"
				detail="2400×1600 · 글 1"
				onSelectedChange={() => {}}
				action={
					<IconButton label="더 보기" className="size-6">
						<MoreHorizontal aria-hidden />
					</IconButton>
				}
			/>
		</Labelled>
	),
};

export const Detail: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			<Labelled name="detail 없음">
				<Tile preview={preview} title="desk-morning.jpg" />
			</Labelled>
			<Labelled name="긴 이름은 말줄임">
				<Tile
					preview={preview}
					title="아주아주아주 긴 파일 이름의 여름 바다 사진.png"
					detail="/covers/아주아주아주-긴-경로.png"
				/>
			</Labelled>
			<Labelled name="preview 대체">
				<Tile
					preview={<Image src={null} alt="" fallback={FileText} ratio="photo" radius="none" />}
					title="문서.pdf"
					detail="340KB"
				/>
			</Labelled>
		</Stack>
	),
};

/** A folder is a low tile with its icon, name and count. */
export const Folders: Story = {
	render: () => (
		<div className="grid w-[640px] grid-cols-3 gap-x-monti-20 gap-y-monti-12">
			<FolderTile name="covers" count={6} />
			<FolderTile name="diagrams" count={3} />
			<FolderTile name="상위 폴더로" icon={<FolderUp aria-hidden />} />
			<FolderTile name="menu open" count={4} selected />
			<FolderTile name="files over it" count={4} dropTarget />
			<FolderTile name="아주아주아주 긴 폴더 이름도 한 줄에서 잘려요" count={12} />
		</div>
	),
};

/** `action` is the ⋯ at the right, shown with the pointer and in place of the count (point at the first folder; the second shows it open). */
export const FolderWithMenu: Story = {
	render: () => (
		<div className="grid w-[640px] grid-cols-3 gap-x-monti-20 gap-y-monti-12">
			{[false, true].map((open) => (
				<FolderTile
					key={String(open)}
					name={open ? "menu open" : "covers"}
					count={6}
					selected={open}
					action={
						<IconButton label="더 보기" aria-expanded={open}>
							<MoreHorizontal aria-hidden />
						</IconButton>
					}
				/>
			))}
		</div>
	),
};

function RenameDemo() {
	const [name, setName] = useState("새 폴더");
	return (
		<div className="grid w-[640px] grid-cols-3 gap-x-monti-20">
			<FolderTile>
				<RenameField
					value={name}
					onValueChange={setName}
					onCommit={() => {}}
					onCancel={() => {}}
					label="폴더 이름"
					fill
				/>
			</FolderTile>
		</div>
	);
}

/** A new folder, or a rename, is edited in the tile with its whole name selected. */
export const Renaming: Story = { render: () => <RenameDemo /> };

function GridDemo({ over, folderOver }: { over: boolean; folderOver: boolean }) {
	const [picked, setPicked] = useState<number[]>([1]);
	const toggle = (index: number) =>
		setPicked((now) => (now.includes(index) ? now.filter((item) => item !== index) : [...now, index]));
	return (
		<DropArea over={over} className="w-[720px]">
			<div className="grid grid-cols-4 gap-x-monti-20 gap-y-monti-12 px-monti-12 pt-monti-24">
				<FolderTile name="covers" count={6} dropTarget={folderOver} />
				<FolderTile name="diagrams" count={3} />
			</div>
			<div className="grid grid-cols-4 gap-x-monti-20 gap-y-monti-24 px-monti-12 pt-monti-24">
				{["desk-morning.jpg", "notes.png", "cover-a.png", "cover-b.png"].map((name, index) => (
					<Tile
						key={name}
						preview={preview}
						title={name}
						detail="2400×1600 · 글 1"
						selected={picked.includes(index)}
						picking={picked.length > 0}
						onSelectedChange={() => toggle(index)}
						selectLabel={`${name} 선택`}
					/>
				))}
			</div>
		</DropArea>
	);
}

export const InGrid: Story = {
	decorators: [],
	render: () => <GridDemo over={false} folderOver={false} />,
};

/** Files dragged over the grid: a line and a tint around all of it, the tiles unchanged. */
export const DroppingOnTheGrid: Story = {
	decorators: [],
	render: () => <GridDemo over folderOver={false} />,
};

/** Over a subfolder, the grid's frame goes out and that folder takes the drop look. */
export const DroppingOnAFolder: Story = {
	decorators: [],
	render: () => <GridDemo over={false} folderOver />,
};

const KINDS = [
	{ icon: <Type aria-hidden />, title: "텍스트", hint: "짧은 글자 한 줄" },
	{ icon: <ImageGlyph aria-hidden />, title: "이미지", hint: "사진이나 그림 한 장" },
	{ icon: <Table2 aria-hidden />, title: "표", hint: "행과 열로 된 값" },
];

export const ChoiceCards: Story = {
	render: () => {
		const [picked, setPicked] = useState(0);
		return (
			<Stack gap={8} className="max-w-sm">
				{KINDS.map((kind, index) => (
					<ChoiceCard
						key={kind.title}
						icon={kind.icon}
						title={kind.title}
						hint={kind.hint}
						selected={picked === index}
						onClick={() => setPicked(index)}
					/>
				))}
			</Stack>
		);
	},
};

export const ChoiceCardOptions: Story = {
	render: () => (
		<Stack gap={24} className="max-w-sm">
			<Stack gap={4}>
				<Text variant="label" tone="muted">
					selected false
				</Text>
				<ChoiceCard icon={<Type aria-hidden />} title="텍스트" hint="짧은 글자 한 줄" />
			</Stack>
			<Stack gap={4}>
				<Text variant="label" tone="muted">
					selected true
				</Text>
				<ChoiceCard icon={<Type aria-hidden />} title="텍스트" hint="짧은 글자 한 줄" selected />
			</Stack>
			<Stack gap={4}>
				<Text variant="label" tone="muted">
					disabled
				</Text>
				<ChoiceCard icon={<Type aria-hidden />} title="텍스트" hint="지금은 고를 수 없어요" disabled />
			</Stack>
			<Stack gap={4}>
				<Text variant="label" tone="muted">
					icon 없음, hint 없음
				</Text>
				<ChoiceCard title="텍스트" />
			</Stack>
		</Stack>
	),
};
