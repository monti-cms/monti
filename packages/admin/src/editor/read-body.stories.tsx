import { blocks, marks } from "@monti-cms/blocks";
import type { Doc } from "@monti-cms/core";
import { Compare, CompareSide, EditorBody, useBarScope } from "@monti-cms/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StorySite } from "../../.storybook/pglite-site";
import { type AdminBlockDefinition, type AdminMarkDefinition, AdminProvider } from "../operations/admin-context";
import { sideMarks } from "../screens/entry/compare-entries";
import * as site from "../screens/entry/site-blocks.stories";
import { useBlockNames } from "../screens/entry/use-block-names";
import { ReadBodies, ReadBody } from "./read-body";
import { BLOCKS, BROKEN, FOLDED, IMAGES, MINE, MOVED_A, MOVED_B, THEIRS, TODO } from "./test/read-body-docs";

/** How the body is read: the way a screen would give it (`size`, `muted`, `ground`), the answer still arriving, a page whose text is written around it. */
type Options = {
	failCatalog?: boolean;
	streaming?: boolean;
	size?: "reading" | "chat" | "card";
	muted?: boolean;
	ground?: "page" | "tool";
	/** The body stands inside the editor's written text (an `EditorBody` with `contenteditable` in it), as a source cell does in a side-by-side translation. */
	inEditable?: boolean;
	/** A site block whose drawing throws when it is drawn (its type). */
	breakSite?: string;
	/** A site block whose drawing only says the bar scope it is drawn in (`data-scope`): where the body stands. */
	probeSite?: string;
	/** The library's files, as `media.query` answers them. */
	media?: { id: string; name: string }[];
};

export type Loaded = site.Loaded & {
	mine: Doc;
	theirs: Doc | null;
	/** The addresses of the admin the body's links opened. */
	opened: string[];
	options: Options;
};

/** The site of the site-blocks story with the body (`mine`) and, when there is one, the body it is read against (`theirs`), each side drawn by `ReadBody`. */
export const read = (mine: Doc, theirs: Doc | null, options: Options = {}) => [
	async (): Promise<Loaded> => {
		const loaded = await (site.site(null)[0] as () => Promise<site.Loaded>)();
		// A site whose catalog cannot be read: its bodies are drawn as their words.
		if (options.failCatalog) {
			const { transport } = loaded.site;
			loaded.site.transport = async (name, input, init) =>
				name === "blocks.catalog" ? { status: 500, body: { error: "down" } } : transport(name, input, init);
		}
		if (options.media) {
			const { transport } = loaded.site;
			const items = options.media.map((file) => ({ ...file, kind: "image" }));
			loaded.site.transport = async (name, input, init) =>
				name === "media.query"
					? { status: 200, body: { storage: true, items, total: items.length, page: 1, pageSize: 50 } }
					: transport(name, input, init);
		}
		return { ...loaded, mine, theirs, opened: [], options };
	},
];

function Both({
	mine,
	theirs,
	opened,
	options,
}: {
	mine: Doc;
	theirs: Doc | null;
	opened: string[];
	options: Options;
}) {
	const names = useBlockNames();
	const shared = { size: options.size, muted: options.muted, ground: options.ground };
	const body = (
		<Compare>
			<CompareSide label="mine">
				<ReadBody
					doc={mine}
					marks={sideMarks(mine, theirs, "mine", names)}
					streaming={options.streaming}
					onOpen={(address) => opened.push(address)}
					{...shared}
				/>
			</CompareSide>
			<CompareSide label="theirs">
				{theirs ? <ReadBody doc={theirs} marks={sideMarks(theirs, mine, "server", names)} {...shared} /> : null}
			</CompareSide>
		</Compare>
	);
	// The real case: the editor's own body, its text written (`contenteditable`), with the read bodies standing in it (a side-by-side translation's source cells).
	return options.inEditable ? (
		<EditorBody>
			<div contentEditable suppressContentEditableWarning>
				{body}
			</div>
		</EditorBody>
	) : (
		body
	);
}

/** A drawing that says where it is drawn. */
function Probe() {
	return <div data-scope={useBarScope()} />;
}

/** A drawing that cannot be drawn. */
function Broken(): never {
	throw new Error("a drawing that throws");
}

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Editor/Read body",
	render: (_args, { loaded }) => {
		const { site: made, mine, theirs, opened, options } = loaded as Loaded & { site: StorySite };
		return (
			<AdminProvider
				transport={made.transport}
				streams={made.streams}
				siteName="example.dev"
				blocks={(blocks as unknown as AdminBlockDefinition[]).map((block) =>
					block.type === options.breakSite
						? { ...block, Site: Broken }
						: block.type === options.probeSite
							? { ...block, Site: Probe }
							: block,
				)}
				marks={marks as unknown as AdminMarkDefinition[]}
			>
				<ReadBodies>
					<Both mine={mine} theirs={theirs} opened={opened} options={options} />
				</ReadBodies>
			</AdminProvider>
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A body read against another: bold, a link, inline code, a heading's level, a code block with its head, effects and colours, a site's blocks, and the words that differ marked the same on both sides. */
export const Formatting: Story = { loaders: read(MINE, THEIRS) };

/** Code read as the editor draws it at 12px: its line effects and numbers, a rule's bold words, a tooltip, and a closed fold that opens with the editor's own buttons. */
export const CodeWithEffectsAndFold: Story = { loaders: read({ type: "doc", blocks: [FOLDED] }, null) };

/** A site's own blocks given the blocks they hold: tabs with their labels, a code explorer with its tree and file names, columns. */
export const SiteBlocks: Story = { loaders: read(BLOCKS, null) };

/** Two blocks that swapped places: the same highlight as any other change, on both sides, though their words are the same. */
export const MovedBlock: Story = { loaders: read(MOVED_A, MOVED_B) };

/** To-dos read only: the box says its state and is not pressed; a link to a place of the admin. */
export const ToDos: Story = { loaders: read(TODO, null) };

/** Blocks the admin has no drawing for are a box with their name and values (a picture, a block that cannot be made), the changed values marked in it. */
export const BoxFallback: Story = {
	loaders: read({ type: "doc", blocks: [...IMAGES("빌드 시간").blocks, ...BROKEN.blocks] }, IMAGES("속도")),
};

/** The catalog of blocks cannot be read: both sides are their words, not blank. */
export const FailedCatalog: Story = { loaders: read(MINE, THEIRS, { failCatalog: true }) };

/** An assistant's answer: the conversation's text size, 8px between blocks, headings as bold lines, code at most half the window high with wrapping words and no numbers. */
export const Chat: Story = { loaders: read(MINE, null, { size: "chat" }) };

/** A body in the quieter ink, code included: the source beside a translation. */
export const Muted: Story = { loaders: read(MINE, null, { muted: true }) };

/** On the tool ground (a source beside its translation, the left column of a review): code frames and boxes one step darker, on `bg-selected`. */
export const ToolGroundLift: Story = {
	loaders: read({ type: "doc", blocks: [...MINE.blocks, ...IMAGES("빌드 시간").blocks] }, null, {
		muted: true,
		ground: "tool",
	}),
};

/** A card's words (a translation's memo, a stale proposal's): the card's text size with 8px between blocks. */
export const CardSize: Story = { loaders: read(MINE, null, { size: "card" }) };

/** An answer still arriving: its code is not coloured yet, and the caret stands after the last word, inside the last line. */
export const Streaming: Story = {
	loaders: read({ type: "doc", blocks: MINE.blocks.slice(0, 2) }, null, { size: "chat", streaming: true }),
};
