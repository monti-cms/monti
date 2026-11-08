import type { Meta, StoryObj } from "@storybook/react-vite";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { fillLibrary } from "../media/media.stories";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Library = Awaited<ReturnType<typeof fillLibrary>>;

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
export const Draft: Story = { loaders: entry() };

/** An image in the body, with its alt text. */
export const WithImage: Story = {
	loaders: entry({
		body: ({ desk }) => [{ id: "i_1", type: "image", attrs: { media: desk, alt: "아침 책상" } }],
	}),
};

/** A cover in the property panel, with what the entry says of it (T67). */
export const WithCover: Story = {
	loaders: entry({ values: ({ desk }) => ({ cover: { media: desk, alt: "아침 책상" } }) }),
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
};

/** A site with no storage (flow 6·31). */
export const NoStorage: Story = { loaders: entry({ storage: null }) };
