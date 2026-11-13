import { unzip, zip } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";
import { mdxAdmin } from "@monti-cms/mdx/admin";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { samplePhoto } from "../media/media.stories";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Monti = StorySite["monti"];

const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };
const run = <Output = { output: { id: string } }>(monti: Monti, name: string, input: unknown) =>
	monti.run(name, input, admin) as Promise<Output>;

const text = (value: string) => new TextEncoder().encode(value);

/** A blog's posts as files (flow 9, 06–07): front matter, a picture beside them, a component the site has no block for, a post with no summary. */
export async function blogZip(): Promise<File> {
	const bytes = await zip([
		{
			name: "posts/again.md",
			bytes: text(
				[
					"---",
					"title: 다시 쓰는 블로그",
					"date: 2026-03-02",
					"category: 회고",
					"description: 옮겨 온 첫 글",
					"layout: post",
					"---",
					"",
					"블로그를 옮기며 적는다.",
					"",
					"![책상](./img/desk.jpg)",
					"",
					'<Tweet id="20" />',
					"",
				].join("\n"),
			),
		},
		{
			name: "posts/first-post.md",
			bytes: text(["---", "title: 첫 번째 글", "category: 개발", "---", "", "주소가 겹치는 글이다.", ""].join("\n")),
		},
		{
			name: "posts/tools.md",
			bytes: text(["---", "title: 쓰는 도구", "category: 도구", "---", "", "에디터와 키보드.", ""].join("\n")),
		},
		{ name: "posts/img/desk.jpg", bytes: await samplePhoto("#8a6f4d", "#d9c3a0") },
	]);
	return new File([bytes as Uint8Array<ArrayBuffer>], "blog-export.zip", { type: "application/zip" });
}

/** The blog imported already (its posts alone), on the activity log: the import is one line there (flow 9, 10). */
export const logged = (hash = "#/activity") => [
	async (): Promise<Loaded> => {
		const [load] = site();
		const loaded = await (load as () => Promise<Loaded>)();
		const upload = await blogZip();
		const opened = unzip(new Uint8Array(await upload.arrayBuffer()));
		const files: { name: string; text: string }[] = [];
		for (const name of opened?.names.filter((each) => each.endsWith(".md")) ?? [])
			files.push({ name, text: new TextDecoder().decode((await opened?.read(name)) ?? new Uint8Array()) });
		await run(loaded.site.monti, "data.import", {
			collection: "post",
			name: upload.name,
			files,
			has: [],
			mapping: { description: "summary" },
		});
		startAt(hash);
		return loaded;
	},
];

/**
 * The next file chooser the page opens answers with these files: a story and a test cannot press the system's own window. It is undone once
 * it has answered.
 */
export function chooseNext(files: File[]) {
	const click = HTMLInputElement.prototype.click;
	HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
		if (this.type !== "file") return click.call(this);
		HTMLInputElement.prototype.click = click;
		const given = new DataTransfer();
		for (const file of files) given.items.add(file);
		this.files = given.files;
		this.dispatchEvent(new Event("change"));
	};
}

/** The files the page handed the browser to save, from now on: a story and a test keep them instead of the downloads folder. */
export function catchDownloads(): { name: string; file: Blob }[] {
	const saved: { name: string; file: Blob }[] = [];
	const made = new Map<string, Blob>();
	const create = URL.createObjectURL;
	URL.createObjectURL = (file: Blob | MediaSource) => {
		const url = create.call(URL, file);
		if (file instanceof Blob) made.set(url, file);
		return url;
	};
	const click = HTMLAnchorElement.prototype.click;
	HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
		const file = made.get(this.href);
		if (!this.download || !file) return click.call(this);
		saved.push({ name: this.download, file });
	};
	return saved;
}

/** The stories' blog with a few posts and categories, with or without the MDX plugin. */
export const site = (options: { mdx?: boolean; hash?: string; picture?: boolean; hold?: string } = {}) => [
	async (): Promise<Loaded> => {
		startAt(options.hash ?? "#/c/post");
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			plugins: options.mdx === false ? [] : [mdx()],
			setup: async (monti, storage) => {
				// A file in the library: what a backup may take with it.
				if (options.picture && storage) {
					const key = "00000000-0000-4000-8000-000000000001.jpg";
					await storage.put(key, await samplePhoto("#8a6f4d", "#d9c3a0"), { mime: "image/jpeg" });
					await run(monti, "media.upload", { name: "desk.jpg", original: { key, width: 320, height: 180 } });
				}
				for (const [collection, label] of [
					["post", "게시글"],
					["memo", "메모"],
					["category", "카테고리"],
				] as const)
					await run(monti, "collections.updateAdminValues", {
						collection,
						values:
							collection === "post"
								? {
										label,
										fields: {
											summary: { label: "요약" },
											category: { label: "카테고리" },
											cover: { label: "대표 이미지" },
										},
									}
								: { label },
					});
				const category = await run(monti, "entries.create", {
					collection: "category",
					locale: "ko",
					title: "개발",
					slug: "dev",
				});
				for (const [title, slug] of [
					["첫 번째 글", "first-post"],
					["서울의 밤", "seoul-night"],
				])
					await run(monti, "entries.create", {
						collection: "post",
						locale: "ko",
						title,
						slug,
						values: { category: category.output.id },
						doc: { type: "doc", blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: title }] }] },
					});
			},
		});
		// An operation whose answer never comes: the moment the screen is busy with it stays to be seen.
		const { transport } = made;
		if (options.hold)
			made.transport = (name, input, more) =>
				name === options.hold ? new Promise(() => {}) : transport(name, input, more);
		return { site: made };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/List/Import",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return (
			<MontiAdmin transport={made.transport} uploader={made.uploader} siteName="example.dev" plugins={[mdxAdmin]} />
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the pill's menu and picks "import" with the files the chooser will answer. */
export async function importFrom(canvasElement: HTMLElement, files: File[]) {
	const canvas = within(canvasElement);
	await waitFor(() => expect(canvas.getByText("첫 번째 글")).toBeTruthy(), wait);
	await userEvent.click(canvas.getByRole("button", { name: "더 만들기" }));
	chooseNext(files);
	await userEvent.click(await within(document.body).findByRole("menuitem", { name: "가져오기" }, wait));
}

const sheet = () => within(document.body).findByRole("dialog", {}, wait);

/** Flow 9, 06–07: the upload is read. What it holds, the field each key goes to, where the pictures go and what to know. */
export const Read: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await importFrom(canvasElement, [await blogZip()]);
		await waitFor(async () => expect(within(await sheet()).getByText("필드 맞추기")).toBeTruthy(), wait);
	},
};

/** Flow 9, 08: importing. The sheet cannot be left, the fields are held, and the pill says what it is doing. */
export const Importing: Story = {
	loaders: site({ hold: "data.import" }),
	play: async (context) => {
		await Read.play?.(context);
		await userEvent.click(within(await sheet()).getByRole("button", { name: "3편 가져오기" }));
		await waitFor(async () => expect(within(await sheet()).getByText("가져오는 중…")).toBeTruthy(), wait);
	},
};

/** Flow 9, 09: imported. The count, what came with it, the entries whose address was taken, and the way back. */
export const Done: Story = {
	loaders: site(),
	play: async (context) => {
		await Read.play?.(context);
		await userEvent.click(within(await sheet()).getByRole("button", { name: "3편 가져오기" }));
		await waitFor(async () => expect(within(await sheet()).getByText("3편을 가져왔습니다.")).toBeTruthy(), wait);
	},
};

/** Flow 9, 11 and 14-2: a site without the MDX plugin does not read `.md`, and says which plugin does. */
export const NeedsPlugin: Story = {
	loaders: site({ mdx: false }),
	play: async ({ canvasElement }) => {
		await importFrom(canvasElement, [await blogZip()]);
		await waitFor(
			async () => expect(within(await sheet()).getByText("MDX 플러그인이 있어야 읽을 수 있습니다.")).toBeTruthy(),
			wait,
		);
	},
};

/** Flow 9, 11: a file that cannot be read. */
export const Unreadable: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await importFrom(canvasElement, [new File([text("not a zip")], "broken.zip")]);
		await waitFor(async () => expect(within(await sheet()).getByText("읽지 못했습니다.")).toBeTruthy(), wait);
	},
};

/** Flow 9, 10: after the sheet is closed, the import's line of the activity log opens its result: the changed addresses and the way back. */
export const Logged: Story = {
	loaders: logged(),
	play: async ({ canvasElement }) => {
		const line = await within(canvasElement).findByText("blog-export.zip에서 3편 가져옴", {}, wait);
		await userEvent.click(line);
		await waitFor(
			() => expect(within(canvasElement).getByRole("complementary").textContent).toContain("first-post-2"),
			wait,
		);
	},
};
