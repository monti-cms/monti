import { blocks, marks } from "@monti-cms/blocks";
import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import type { AdminBlockDefinition, AdminMarkDefinition } from "../../operations/admin-context";
import { schema } from "../story-schema";

export const admin = { actor: "admin" } as const;
export type Loaded = { site: StorySite; id: string };

const p = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text" as const, text }] });

/** A post with one of each of `@monti-cms/blocks`'s blocks (doc 18), as `monti add` puts them in a site. */
const everyBlock = (): Doc => ({
	type: "doc",
	blocks: [
		p("s1", "블록을 하나씩 넣은 글."),
		{
			id: "callout",
			type: "callout",
			attrs: { tone: "tip", title: "알아 두세요" },
			children: [p("c1", "콜아웃 본문")],
		},
		{
			id: "tabs",
			type: "tabs",
			children: [
				{ id: "t1", type: "tab", attrs: { label: "npm" }, children: [p("t1p", "npm install monti")] },
				{ id: "t2", type: "tab", attrs: { label: "pnpm" }, children: [p("t2p", "pnpm add monti")] },
			],
		},
		{
			id: "columns",
			type: "columns",
			children: [
				{ id: "k1", type: "column", children: [p("k1p", "왼쪽 단")] },
				{ id: "k2", type: "column", children: [p("k2p", "오른쪽 단")] },
			],
		},
		{ id: "fold", type: "collapsible", attrs: { title: "자세히" }, children: [p("f1", "접힌 본문")] },
		{
			id: "explorer",
			type: "codeExplorer",
			children: [
				{
					id: "e1",
					type: "codeBlock",
					attrs: { language: "ts", title: "src/app.ts" },
					content: [{ type: "text", text: "export const app = 1;" }],
				},
				{
					id: "e2",
					type: "codeBlock",
					attrs: { language: "ts", title: "src/db.ts" },
					content: [{ type: "text", text: "export const db = 2;" }],
				},
			],
		},
		{ id: "math", type: "math", attrs: { source: "a^2 + b^2 = c^2" } },
		{
			id: "chart",
			type: "chart",
			attrs: {
				source: "chart bar\nx month\nseries views | 방문 | chart-1\n\ndata\nmonth | views\nJan | 1200\nFeb | 1850",
			},
		},
		p("s2", "끝 문단"),
	],
});

/** The editor on that post, on a site with the package's blocks and marks. */
export const site = (doc: Doc | null = everyBlock()) => [
	async (): Promise<Loaded> => {
		let id = "";
		const made = await storySite({
			schema,
			blocks,
			marks,
			auth: { password: true },
			signedIn: true,
			setup: async (monti) => {
				const created = (await monti.run(
					"entries.create",
					{ collection: "post", locale: "ko", title: "블록 글", slug: "blocks", ...(doc ? { doc } : {}) },
					admin,
				)) as { output: { id: string } };
				id = created.output.id;
			},
		});
		startAt(`#/c/post/${id}`);
		return { site: made, id };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Entry/Site blocks",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return (
			<MontiAdmin
				transport={made.transport}
				streams={made.streams}
				siteName="example.dev"
				blocks={blocks as unknown as AdminBlockDefinition[]}
				marks={marks as unknown as AdminMarkDefinition[]}
			/>
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const wait = { timeout: 15000 };

/** Waits for the body with its blocks. */
async function opened(canvasElement: HTMLElement) {
	const page = within(canvasElement);
	const body = await page.findByRole("textbox", { name: "본문" }, wait);
	await within(body).findByRole("note", {}, wait);
	return { page, body, all: within(canvasElement.ownerDocument.body) };
}
/** A block's frame in the body, by its type. */
const blockOf = (body: HTMLElement, type: string) => {
	const found = body.querySelector<HTMLElement>(`[data-block="${type}"]`);
	if (!found) throw new Error(`no ${type}`);
	return found;
};

/** Every block of the package in the editor (doc 18), at rest. */
export const EveryBlock: Story = { loaders: site() };

/** A callout with the cursor in it: its tool row over its top left, the kind button named by the current kind (its menu is tried in the screen test). */
export const ToolRow: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		// The cursor in it brings its tool row up, as the pointer over it does.
		await userEvent.click(within(blockOf(body, "callout")).getByText("콜아웃 본문"));
		await all.findByRole("button", { name: "종류" }, wait);
	},
};

/** A formula picked: its source open in its own area under the drawing, a reason under the field for what does not read. */
export const SourceWithError: Story = {
	loaders: site({ type: "doc", blocks: [{ id: "math", type: "math", attrs: { source: "\\frac{1}{" } }] }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		const body = await page.findByRole("textbox", { name: "본문" }, wait);
		await press(blockOf(body, "math"));
		await page.findByRole("textbox", { name: "소스" }, wait);
	},
};

/** Picked words with the colour card open from the format bar's ⋯: a row for the text colour, a row for the background. */
export const ColorCard: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await pick(body, "하나씩");
		await userEvent.click(await all.findByRole("button", { name: "다른 서식" }, wait));
		await userEvent.click(await all.findByRole("option", { name: "글자 색" }, wait));
		await all.findByText("배경색", {}, wait);
	},
};

/** Picked words with the tooltip card open from the format bar's ⋯: its title, its two-line note and its buttons. */
export const TooltipCard: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await pick(body, "하나씩");
		await userEvent.click(await all.findByRole("button", { name: "다른 서식" }, wait));
		await userEvent.click(await all.findByRole("option", { name: "툴팁" }, wait));
		await all.findByText("툴팁 넣기", {}, wait);
	},
};

/** A proposal that changes only a callout's kind, on the review page: the row named by the block and its kind, its values before and after. */
export const ReviewNameLine: Story = {
	loaders: [
		async () => {
			const [load] = site();
			if (!load) throw new Error("no site");
			const made = await load();
			const at = new Date();
			await made.site.db
				.insertInto("conversations")
				.values({ id: "c-blocks", title: "검토", created_at: at, last_opened_at: at })
				.execute();
			const proposal = await made.site.monti.proposals.create("c-blocks", "콜아웃을 경고로");
			const read = (await made.site.monti.run("entries.get", { id: made.id }, admin)) as {
				entry: { version: number; doc: Doc };
			};
			const callout = read.entry.doc.blocks.find((block) => block.id === "callout");
			await made.site.monti.proposals.add(proposal, "body.edit", {
				id: made.id,
				version: read.entry.version,
				ops: [
					{ op: "setBlock", block: "callout", value: { ...callout, attrs: { tone: "warning", title: "알아 두세요" } } },
				],
			});
			window.history.replaceState(null, "", `#/ai/review/${proposal}`);
			return made;
		},
	],
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByText("블록 2 · 콜아웃", {}, wait);
	},
};

/** A press at the middle of an element, with the place a real press has (the editor picks the block under it by that place). */
async function press(element: HTMLElement) {
	const box = element.getBoundingClientRect();
	const at = {
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
		bubbles: true,
		cancelable: true,
		button: 0,
	};
	for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
		element.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, at) : new MouseEvent(type, at));
	await new Promise((done) => setTimeout(done, 50));
}

/** Picks the words with the pointer, as a person does: the format bar comes over them. */
async function pick(root: HTMLElement, words: string) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const at = node.textContent?.indexOf(words) ?? -1;
		if (at < 0) continue;
		const range = document.createRange();
		range.setStart(node, at);
		range.setEnd(node, at + words.length);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		(root as HTMLElement).focus();
		document.dispatchEvent(new Event("selectionchange"));
		await new Promise((done) => setTimeout(done, 50));
		return;
	}
	throw new Error(`"${words}" is not in the body`);
}
