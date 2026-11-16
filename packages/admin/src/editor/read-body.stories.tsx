import { blocks, marks } from "@monti-cms/blocks";
import type { Doc } from "@monti-cms/core";
import { Compare, CompareSide } from "@monti-cms/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StorySite } from "../../.storybook/pglite-site";
import { type AdminBlockDefinition, type AdminMarkDefinition, AdminProvider } from "../operations/admin-context";
import { sideMarks } from "../screens/entry/compare-entries";
import * as site from "../screens/entry/site-blocks.stories";
import { useBlockNames } from "../screens/entry/use-block-names";
import { ReadBody } from "./read-body";

export type Loaded = site.Loaded & {
	mine: Doc;
	theirs: Doc | null;
	/** The addresses of the admin the body's links opened. */
	opened: string[];
	streaming: boolean;
};

/** The site of the site-blocks story, with the two bodies to read side by side. */
export const read = (mine: Doc, theirs: Doc | null, options: { failCatalog?: boolean; streaming?: boolean } = {}) => [
	async (): Promise<Loaded> => {
		const loaded = await (site.site(null)[0] as () => Promise<site.Loaded>)();
		// A site whose catalog cannot be read: its bodies are drawn as their words.
		if (options.failCatalog) {
			const { transport } = loaded.site;
			loaded.site.transport = async (name, input, init) =>
				name === "blocks.catalog" ? { status: 500, body: { error: "down" } } : transport(name, input, init);
		}
		return { ...loaded, mine, theirs, opened: [], streaming: options.streaming ?? false };
	},
];

function Both({
	mine,
	theirs,
	opened,
	streaming,
}: {
	mine: Doc;
	theirs: Doc | null;
	opened: string[];
	streaming: boolean;
}) {
	const names = useBlockNames();
	return (
		<Compare>
			<CompareSide label="mine">
				<ReadBody
					doc={mine}
					marks={sideMarks(mine, theirs, "mine", names)}
					streaming={streaming}
					onOpen={(address) => opened.push(address)}
				/>
			</CompareSide>
			<CompareSide label="theirs">
				{theirs ? <ReadBody doc={theirs} marks={sideMarks(theirs, mine, "server", names)} /> : null}
			</CompareSide>
		</Compare>
	);
}

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Editor/Read body",
	render: (_args, { loaded }) => {
		const { site: made, mine, theirs, opened, streaming } = loaded as Loaded & { site: StorySite };
		return (
			<AdminProvider
				transport={made.transport}
				streams={made.streams}
				siteName="example.dev"
				blocks={blocks as unknown as AdminBlockDefinition[]}
				marks={marks as unknown as AdminMarkDefinition[]}
			>
				<Both mine={mine} theirs={theirs} opened={opened} streaming={streaming} />
			</AdminProvider>
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two bodies read side by side: formatting, a code block, a site's blocks and the words that differ marked on both. */
export const Compared: Story = {
	loaders: read(
		{ type: "doc", blocks: [{ id: "a", type: "paragraph", content: [{ type: "text", text: "a" }] }] },
		null,
	),
};
