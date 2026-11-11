import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
const wait = { timeout: 15000 };
type Monti = StorySite["monti"];

const admin = { actor: "admin" } as const;
export const run = <Output = { output: { id: string } }>(monti: Monti, name: string, input: unknown) =>
	monti.run(name, input, admin) as Promise<Output>;

/**
 * A sample photo as the reference paints it: a slanted gradient between two colours, small and real, so it loads like any picture. It has the shape of the
 * size it is said to have (16:9 unless told), so a crop drawn on it is the crop the body shows.
 */
export async function samplePhoto(from: string, to: string, shape = { width: 16, height: 9 }): Promise<Uint8Array> {
	const width = 320;
	const height = Math.round((width * shape.height) / shape.width);
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("No 2d context for the sample photo.");
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, from);
	gradient.addColorStop(1, to);
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
	return new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg" })).arrayBuffer());
}

let keys = 0;
const nextKey = (extension: string) => `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}${extension}`;

/** Puts a file in the story's storage and makes the item, as an upload ends. */
/** A photo of two colours put in the library, as an upload would. */
export async function addFile(
	site: { monti: Monti; storage: StorySite["storage"] },
	file: { name: string; from: string; to: string; width: number; height: number; folderId?: string | null },
) {
	const key = nextKey(".jpg");
	await site.storage?.put(key, await samplePhoto(file.from, file.to, file), { mime: "image/jpeg" });
	const { output } = await run(site.monti, "media.upload", {
		name: file.name,
		folderId: file.folderId ?? null,
		original: { key, width: file.width, height: file.height },
	});
	return output.id;
}

async function addDocument(
	site: { monti: Monti; storage: StorySite["storage"] },
	file: { name: string; size: number; mime: string; extension: string; folderId?: string | null },
) {
	const key = nextKey(file.extension);
	await site.storage?.put(key, new Uint8Array(file.size), { mime: file.mime });
	const { output } = await run(site.monti, "media.upload", {
		name: file.name,
		folderId: file.folderId ?? null,
		original: { key },
	});
	return output.id;
}

/** The reference library (`Screens/Reference/Lists` › Media): Blog Assets with its folders and files, some of them in use. */
export async function fillLibrary(monti: Monti, storage: StorySite["storage"]) {
	await monti.run(
		"collections.updateAdminValues",
		{ collection: "post", values: { label: "게시글", fields: { cover: { label: "대표 이미지" } } } },
		admin,
	);
	await monti.run("collections.updateAdminValues", { collection: "memo", values: { label: "메모" } }, admin);
	await monti.run("collections.updateAdminValues", { collection: "category", values: { label: "카테고리" } }, admin);
	const site = { monti, storage };
	const folder = async (name: string, parentId: string | null = null) =>
		(await run(monti, "folders.create", { scope: "media", parentId, name })).output.id;
	const assets = await folder("Blog Assets");
	await folder("Wallpapers");
	const covers = await folder("covers", assets);
	await folder("diagrams", assets);
	const code = await addFile(site, {
		name: "cybersecurity-code.jpg",
		from: "#2f3a2c",
		to: "#121611",
		width: 1600,
		height: 900,
		folderId: assets,
	});
	const desk = await addFile(site, {
		name: "desk-morning.jpg",
		from: "#d8cdb8",
		to: "#a69479",
		width: 2400,
		height: 1600,
		folderId: assets,
	});
	await addFile(site, {
		name: "seoul-night.jpg",
		from: "#3a3f55",
		to: "#1c1e2b",
		width: 3000,
		height: 2000,
		folderId: assets,
	});
	const notes = await addDocument(site, {
		name: "notes-scan.pdf",
		size: 2_200_000,
		mime: "application/pdf",
		extension: ".pdf",
		folderId: assets,
	});
	await addFile(site, {
		name: "cafe-window.jpg",
		from: "#b9a184",
		to: "#6d5a44",
		width: 2000,
		height: 1333,
		folderId: covers,
	});
	await addFile(site, { name: "top-level-photo.jpg", from: "#7d8c6a", to: "#3b4630", width: 1200, height: 800 });
	const inBody = { id: "b_1", type: "image", attrs: { media: code, alt: "화면에 뜬 코드" } };
	await run(monti, "entries.create", {
		collection: "post",
		locale: "ko",
		title: "보안 이야기",
		slug: "security",
		values: { cover: { media: code, alt: "코드" } },
		doc: { type: "doc", blocks: [inBody] },
	});
	await run(monti, "entries.create", {
		collection: "post",
		locale: "ko",
		title: "아침 책상",
		slug: "morning-desk",
		values: { cover: { media: desk, alt: "책상" } },
	});
	return { assets, covers, code, desk, notes };
}

/** Starts at an address with the library filled, signed in. */
export const library = (
	hash = "#/media",
	{
		also,
		...options
	}: { storage?: null; also?: (monti: Monti, ids: Awaited<ReturnType<typeof fillLibrary>>) => Promise<void> } = {},
) => [
	async (): Promise<Loaded> => {
		startAt(hash);
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			setup:
				options.storage === null
					? undefined
					: async (monti, storage) => {
							const ids = await fillLibrary(monti, storage);
							await also?.(monti, ids);
						},
			...options,
		});
		return { site: made };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Media",
	render: (_args, { loaded }) => {
		const { site } = loaded as Loaded;
		return <MontiAdmin transport={site.transport} uploader={site.uploader} siteName="example.dev" />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Flow 6·07: the top of the library, its folders and the files in no folder. */
export const Top: Story = { loaders: library() };

/** Flow 6·08: inside a folder, its subfolders and files under its path. */
export const InFolder: Story = {
	loaders: library(),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /^Blog Assets/ }, wait));
	},
};

/** Flow 6·16: a file open beside the grid, with where it is used. */
export const FilePanel: Story = {
	loaders: library(),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: /^Blog Assets/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: /cybersecurity-code/ }, wait));
	},
};

/** Flow 6·16: a file used in many places. The list grows with them, and a long title is cut before its places. */
export const FilePanelManyUses: Story = {
	loaders: library("#/media", {
		also: async (monti, { code }) => {
			const posts = [
				["봄맞이 블로그 개편 회고: 무엇을 바꾸고 무엇을 남겼는지에 대하여", "spring-redesign"],
				["개발자의 책상", "dev-desk"],
				["비밀번호를 지키는 다섯 가지 습관", "five-habits"],
				["2026년 상반기 보안 사고 정리", "incidents-2026"],
				["새벽 코딩", "dawn-coding"],
			];
			for (const [title, slug] of posts)
				await run(monti, "entries.create", {
					collection: "post",
					locale: "ko",
					title,
					slug,
					values: slug === "dev-desk" ? undefined : { cover: { media: code, alt: "코드" } },
					doc:
						slug === "five-habits"
							? undefined
							: { type: "doc", blocks: [{ id: "b_1", type: "image", attrs: { media: code, alt: "코드" } }] },
				});
		},
	}),
	play: FilePanel.play,
};

/** Flow 6·20: files picked, the bar in place of the tools. */
export const Picked: Story = {
	loaders: library(),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: /^Blog Assets/ }, wait));
		await userEvent.click(await page.findByRole("checkbox", { name: "seoul-night.jpg 고르기" }, wait));
		await userEvent.click(page.getByRole("checkbox", { name: "notes-scan.pdf 고르기" }));
	},
};

/** Flow 6·15: a search reaching through the folders. */
export const Searching: Story = { loaders: library("#/media?q=cafe") };

/** Flow 6·33: a kind chosen, a dot after the filter's name. */
export const KindChosen: Story = { loaders: library("#/media?kind=image") };

/** A search inside a folder: the chip in the search box says where it looks, this folder or all of them. At the top (`Searching`) there is no chip. */
export const SearchingInFolder: Story = {
	loaders: library(),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: /^Blog Assets/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "검색" }, wait));
		await userEvent.keyboard("cafe");
	},
};

/** A filter inside a folder: the folders give way, and it looks in this folder (every folder is the search box's choice). */
export const KindChosenInFolder: Story = {
	loaders: library(),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: /^Blog Assets/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "종류" }, wait));
		await userEvent.click(await within(document.body).findByRole("menuitemcheckbox", { name: /이미지/ }, wait));
		await userEvent.keyboard("{Escape}");
	},
};

/** The grid has no columns, so one menu holds every order: what it is ordered by, then which way. */
export const SortMenu: Story = {
	loaders: library(),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /^올린 날/ }, wait));
	},
};

/** The list view (flow 6·14). */
export const ListView: Story = { loaders: library("#/media?view=list") };

/** The list view with every column dragged to its narrowest: each cell cuts its value with "…" at its own edge. */
export const ListViewNarrowColumns: Story = {
	loaders: library("#/media?view=list"),
	beforeEach: () => {
		localStorage.setItem(
			"monti:media-columns",
			JSON.stringify({ uses: 60, type: 60, size: 60, measure: 60, date: 60 }),
		);
		return () => localStorage.removeItem("monti:media-columns");
	},
};

/** A column's menu in the list view holds both ways (every table's columns, components/list.md). */
export const ListViewSizeMenu: Story = {
	loaders: library("#/media?view=list"),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "크기" }, wait));
	},
};

/** A file open beside the list: only the name and the day stay, and the name's menu holds every order, then the filters. */
export const ListViewFileOpenNameMenu: Story = {
	loaders: library("#/media?view=list"),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("link", { name: "Blog Assets" }, wait));
		await userEvent.click(await page.findByRole("link", { name: "desk-morning.jpg" }, wait));
		await userEvent.click(await page.findByRole("button", { name: /^이름/ }, wait));
	},
};

/** The list view inside a folder, a row picked: the bulk bar takes the head's place, and the filters stay above (T113). */
export const ListViewPicked: Story = {
	loaders: library("#/media?view=list"),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("link", { name: "Blog Assets" }, { timeout: 15000 }));
		const name = await page.findByText("desk-morning.jpg", {}, { timeout: 15000 });
		const row = name.closest("tr");
		if (row) await userEvent.click(within(row).getByRole("checkbox"));
	},
};

/** Flow 6·31: a site with no storage. */
export const NoStorage: Story = { loaders: library("#/media", { storage: null }) };
