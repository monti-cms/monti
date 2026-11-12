import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { addFile, fillLibrary } from "../media/media.stories";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Library = Awaited<ReturnType<typeof fillLibrary>> & { icon?: string };
const wait = { timeout: 15000 };

const paragraph = { id: "p_1", type: "paragraph", content: [{ type: "text", text: "글의 첫 문단이에요." }] };

/** An entry on the reference library, open in the editor. `body` puts what it holds after the first paragraph. */
const entry = (
	options: {
		body?: (ids: Library) => unknown[];
		values?: (ids: Library) => Record<string, unknown>;
		translate?: string;
		storage?: null;
		/** Puts a picture smaller than the body in the library too (80 × 80). */
		icon?: true;
		/** The entry is archived: read-only (doc 02). */
		archived?: true;
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
				const library = storage ? await fillLibrary(monti, storage) : null;
				const ids: Library | null =
					library && options.icon
						? {
								...library,
								icon: await addFile(
									{ monti, storage },
									{ name: "icon.png", from: "#d8693c", to: "#7a2e12", width: 80, height: 80 },
								),
							}
						: library;
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
				if (options.archived) await monti.run("entries.archive", { ids: [id] }, { actor: "admin" });
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

/** The edit dialog (T122), a 16:9 part kept: the picture large; under it turning and the shape, then the size in px or % of the body. */
export const EditDialog: Story = {
	loaders: blankImage,
	play: async () => {
		await toTheImage();
		const page = within(document.body);
		await userEvent.keyboard("{Escape}");
		await userEvent.click(await page.findByRole("button", { name: "편집" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "16:9" }, wait));
	},
};

/** The edit dialog with the size as a share of the body: one field, no height, since the body's width decides it. */
export const EditDialogShare: Story = {
	loaders: blankImage,
	play: async () => {
		await toTheImage();
		const page = within(document.body);
		await userEvent.keyboard("{Escape}");
		await userEvent.click(await page.findByRole("button", { name: "편집" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "%" }, wait));
	},
};

/** A picture smaller than the body (80 × 80): it stands at its own size, not stretched to the body. */
export const SmallImage: Story = {
	loaders: entry({
		icon: true,
		body: ({ icon }) => [{ id: "i_1", type: "image", attrs: { media: String(icon), alt: "아이콘" } }],
	}),
};

/**
 * A picture given a width in px wider than the body (1000, drawn at the body's width, as a narrower site draws it) and one given a share of the body
 * (50%): each says its size while a corner is dragged.
 */
export const SizedImages: Story = {
	loaders: entry({
		body: ({ desk, code }) => [
			{ id: "i_1", type: "image", attrs: { media: desk, alt: "아침 책상", width: 1000 } },
			{ id: "i_2", type: "image", attrs: { media: code, alt: "화면에 뜬 코드", widthPercent: 50 } },
		],
	}),
};

/** Flow 6·38: a file in the body. */
export const FileInBody: Story = {
	loaders: entry({
		body: ({ notes }) => [{ id: "f_1", type: "file", attrs: { media: notes } }],
	}),
};

/** A body of several pictures and files: read together when the entry opens (T110). */
export const ManyInBody: Story = {
	loaders: entry({
		body: ({ desk, code, notes }) => [
			{ id: "i_1", type: "image", attrs: { media: desk, alt: "아침 책상" } },
			{ id: "f_1", type: "file", attrs: { media: notes } },
			{ id: "i_2", type: "image", attrs: { media: code, alt: "화면에 뜬 코드" } },
		],
	}),
};

/** A translation whose body ends in a picture after a file: side by side, each block stands between cells the editor does not edit (T134). */
export const TranslationEndsInPicture: Story = {
	loaders: entry({
		translate: "en",
		body: ({ code, notes }) => [
			{ id: "f_1", type: "file", attrs: { media: notes } },
			{ id: "i_1", type: "image", attrs: { media: code, alt: "화면에 뜬 코드" } },
		],
	}),
	tags: ["!dev"],
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
		// At the top, the only "Blog Assets" button is its folder's card.
		await userEvent.click(await dialog.findByRole("button", { name: /^Blog Assets/ }, wait));
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

/**
 * An archived entry's cover: the line is the value to read (no hand, no ×), and its settings card still opens, its fields read-only, so what the entry says of
 * the picture can be read (T125, 2026-11-11 owner).
 */
export const ArchivedCover: Story = {
	loaders: entry({ values: ({ desk }) => ({ cover: { media: desk, alt: "아침 책상" } }), archived: true }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const open = await page.findByRole("button", { name: "속성" }, wait);
		if (open.getAttribute("aria-pressed") !== "true") await userEvent.click(open);
		await userEvent.click(await page.findByRole("button", { name: "대표 이미지 설정" }, wait));
	},
};

/** An archived entry's picture in the body, picked: its bar has only the settings, and their card's fields are read-only (T130). */
export const ArchivedImage: Story = {
	loaders: entry({
		body: ({ desk }) => [{ id: "i_1", type: "image", attrs: { media: desk, alt: "아침 책상" } }],
		archived: true,
	}),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		// A press where the picture is: the editor picks a block by where the pointer is.
		const picture = await page.findByRole("img", { name: "아침 책상" }, wait);
		const box = picture.getBoundingClientRect();
		await userEvent.pointer({
			keys: "[MouseLeft]",
			target: picture,
			coords: { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 },
		});
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
	},
};

/**
 * An archived entry with two pictures one over the other (T133): each is a place the keyboard stops at. The first is picked by a press (its line, its bar);
 * the keyboard is on the second, which shows the ordinary focus mark. Two states, each looking as it does everywhere.
 */
export const ArchivedPictures: Story = {
	loaders: entry({
		body: ({ desk, code }) => [
			{ id: "i_1", type: "image", attrs: { media: desk, alt: "아침 책상" } },
			{ id: "i_2", type: "image", attrs: { media: code, alt: "화면에 뜬 코드" } },
		],
		archived: true,
	}),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const first = await page.findByRole("img", { name: "아침 책상" }, wait);
		await page.findByRole("img", { name: "화면에 뜬 코드" }, wait);
		const box = first.getBoundingClientRect();
		await userEvent.pointer({
			keys: "[MouseLeft]",
			target: first,
			coords: { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 },
		});
		await page.findByRole("toolbar", {}, wait);
		const blocks = [...canvasElement.ownerDocument.querySelectorAll<HTMLElement>("[data-slot=block-box]")];
		// As the keyboard arrives: the browser draws the keyboard's focus after a key.
		await userEvent.keyboard("{Shift}");
		blocks[1]?.focus();
	},
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
	play: TranslationCover.play,
};

/** A site with no storage (flow 6·31). */
export const NoStorage: Story = { loaders: entry({ storage: null }) };
