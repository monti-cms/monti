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

export type Loaded = site.Loaded & { mine: Doc; theirs: Doc | null };

/** The site of the site-blocks story, with the two bodies to read side by side. */
export const read = (mine: Doc, theirs: Doc | null) => [
	async (): Promise<Loaded> => ({ ...(await (site.site(null)[0] as () => Promise<site.Loaded>)()), mine, theirs }),
];

function Both({ mine, theirs }: { mine: Doc; theirs: Doc | null }) {
	const names = useBlockNames();
	return (
		<Compare>
			<CompareSide label="mine">
				<ReadBody doc={mine} marks={sideMarks(mine, theirs, "mine", names)} />
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
		const { site: made, mine, theirs } = loaded as Loaded & { site: StorySite };
		return (
			<AdminProvider
				transport={made.transport}
				streams={made.streams}
				siteName="example.dev"
				blocks={blocks as unknown as AdminBlockDefinition[]}
				marks={marks as unknown as AdminMarkDefinition[]}
			>
				<Both mine={mine} theirs={theirs} />
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
