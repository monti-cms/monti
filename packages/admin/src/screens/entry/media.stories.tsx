import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { fillLibrary } from "../media/media.stories";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Library = Awaited<ReturnType<typeof fillLibrary>>;
const wait = { timeout: 15000 };

const paragraph = { id: "p_1", type: "paragraph", content: [{ type: "text", text: "글의 첫 문단이에요." }] };

/** An entry on the reference library, open in the editor. `body` puts what it holds after the first paragraph. */
const entry = (
	options: {
		body?: (ids: Library) => unknown[];
		values?: (ids: Library) => Record<string, unknown>;
		translate?: string;
		storage?: null;
	} = {},
) => [
	async (): Promise<Loaded> => {
		startAt("#/");
		let id = "";
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			...(options.storage === null ? { storage: null } : {}),
			setup: async (monti, storage) => {
				const ids = storage ? await fillLibrary(monti, storage) : null;
				const run = async (name: string, input: unknown) =>
					((await monti.run(name, input, { actor: "admin" })) as { output: { id: string } }).output.id;
				id = await run("entries.create", {
					collection: "post",
					locale: "ko",
					title: "쓰는 중인 글",
					slug: "writing",
					values: ids && options.values ? options.values(ids) : undefined,
					doc: { type: "doc", blocks: [paragraph, ...(ids && options.body ? options.body(ids) : [])] },
				});
				if (options.translate) id = await run("translations.create", { source: id, locale: options.translate });
			},
		});
		window.location.hash = `#/c/post/${id}`;
		return { site: made };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/EditorMedia",
	render: (_args, { loaded }) => {
		const { site } = loaded as Loaded;
		return <MontiAdmin transport={site.transport} uploader={site.uploader} siteName="example.dev" />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** An entry with no file yet, on a filled library: "/" and pasting. */
export const Draft: Story = { loaders: entry(), tags: ["!dev"] };

/** An image in the body, with its alt text. */
export const WithImage: Story = {
	loaders: entry({
		body: ({ desk }) => [{ id: "i_1", type: "image", attrs: { media: desk, alt: "아침 책상" } }],
	}),
};

/** Goes to the body's image the way a to-do row does: it is picked, with its settings card open. */
const toTheImage = async () => {
	const page = within(document.body);
	await userEvent.click(await page.findByRole("button", { name: /할 일/ }, wait));
	await userEvent.click(await page.findByRole("button", { name: /대체 텍스트 넣기/ }, wait));
	await page.findByRole("toolbar", {}, wait);
};
const blankImage = entry({
	body: ({ desk }) => [{ id: "i_1", type: "image", attrs: { media: desk } }],
});

/** Flow 6·06, 1·12: the picture picked, its tools and settings card open. */
export const ImageTools: Story = { loaders: blankImage, play: toTheImage };

/** The crop dialog, a 16:9 part kept: the picture large, one line of tools under it. */
export const CropDialog: Story = {
	loaders: blankImage,
	play: async () => {
		await toTheImage();
		const page = within(document.body);
		await userEvent.keyboard("{Escape}");
		await userEvent.click(await page.findByRole("button", { name: "자르기" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "16:9" }, wait));
	},
};

/** Flow 6·38: a file in the body. */
export const FileInBody: Story = {
	loaders: entry({
		body: ({ notes }) => [{ id: "f_1", type: "file", attrs: { media: notes } }],
	}),
};

/** Flow 6·29: the library's window open from the "/" menu. */
export const LibraryWindow: Story = {
	loaders: entry(),
	play: async () => {
		const page = within(document.body);
		const body = await page.findByRole("textbox", { name: "본문" }, wait);
		await userEvent.click(body);
		await userEvent.keyboard("/이미지");
		await userEvent.keyboard("{Enter}");
		await page.findByRole("dialog", {}, wait);
	},
};

/** The window inside a folder: its folders over its own files (T117). */
export const LibraryInFolder: Story = {
	loaders: entry(),
	play: async (context) => {
		await LibraryWindow.play?.(context);
		const dialog = within(within(document.body).getByRole("dialog"));
		await userEvent.click(
			await within(dialog.getByRole("navigation")).findByRole("button", { name: /^Blog Assets/ }, wait),
		);
		await dialog.findByRole("button", { name: /desk-morning/ }, wait);
	},
};

/** A search inside a folder: its folders give way, each file says where it is, and the search can widen (T117). */
export const LibrarySearching: Story = {
	loaders: entry(),
	play: async (context) => {
		await LibraryInFolder.play?.(context);
		const dialog = within(within(document.body).getByRole("dialog"));
		await userEvent.type(dialog.getByRole("searchbox", { name: "파일 이름 검색" }), "cafe");
		await dialog.findByRole("button", { name: /cafe-window/ }, wait);
	},
};

/** A cover in the property panel, with what the entry says of it (T67). */
export const WithCover: Story = {
	loaders: entry({ values: ({ desk }) => ({ cover: { media: desk, alt: "아침 책상" } }) }),
};

/** A cover's settings card open, under its line and as wide as it. */
export const CoverCard: Story = {
	loaders: entry({ values: ({ desk }) => ({ cover: { media: desk, alt: "아침 책상" } }) }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const open = await page.findByRole("button", { name: "속성" }, wait);
		if (open.getAttribute("aria-pressed") !== "true") await userEvent.click(open);
		await userEvent.click(await page.findByRole("button", { name: "대표 이미지 설정" }, wait));
	},
};

/** An image and a cover with nothing to say for them: the to-do row goes to each (flow 1·10, 1·12). */
export const MissingAlt: Story = {
	loaders: entry({
		values: ({ desk }) => ({ cover: { media: desk } }),
		body: ({ code, desk }) => [
			{ id: "i_1", type: "image", attrs: { media: desk } },
			{ id: "i_2", type: "image", attrs: { media: code } },
		],
	}),
};

/** An English translation whose cover follows the source's until it has its own (doc 09, 2026-11-09). */
export const TranslationCover: Story = {
	loaders: entry({
		values: ({ desk }) => ({ cover: { media: desk, alt: "아침 책상" } }),
		translate: "en",
	}),
	// A translation opens with its source beside it and the panel closed.
	play: async () => {
		const page = within(document.body);
		const properties = await page.findByRole("button", { name: "속성" }, wait);
		if (properties.getAttribute("aria-pressed") !== "true") await userEvent.click(properties);
	},
};

/** A translation's own cover, its source's since changed: the mark in the place of whose value it is (T111). */
export const TranslationCoverChanged: Story = {
	loaders: [
		async (): Promise<Loaded> => {
			startAt("#/");
			let id = "";
			const made = await storySite({
				schema,
				auth: { password: true },
				signedIn: true,
				setup: async (monti, storage) => {
					const ids = await fillLibrary(monti, storage);
					const run = async <Output = { id: string; version: number }>(name: string, input: unknown) =>
						((await monti.run(name, input, { actor: "admin" })) as { output: Output }).output;
					const source = await run("entries.create", {
						collection: "post",
						locale: "ko",
						title: "쓰는 중인 글",
						slug: "writing",
						values: { cover: { media: ids.desk, alt: "아침 책상" } },
						doc: { type: "doc", blocks: [paragraph] },
					});
					await run("entries.publish", { ids: [source.id] });
					const translation = await run("translations.create", { source: source.id, locale: "en" });
					await run("entries.save", {
						id: translation.id,
						version: 1,
						title: "Writing",
						values: { cover: { media: ids.desk, alt: "A desk in the morning" } },
					});
					await run("entries.save", {
						id: source.id,
						version: 2,
						values: { cover: { media: ids.code, alt: "화면에 뜬 코드" } },
					});
					await run("entries.publish", { ids: [source.id] });
					id = translation.id;
				},
			});
			window.location.hash = `#/c/post/${id}`;
			return { site: made };
		},
	],
};

/** A site with no storage (flow 6·31). */
export const NoStorage: Story = { loaders: entry({ storage: null }) };
