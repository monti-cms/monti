import { blocks, marks } from "@monti-cms/blocks";
import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
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

/** Every block of the package in the editor (doc 18): each with its own tool row while the pointer is over it or the cursor in it. */
export const EveryBlock: Story = { loaders: site() };
