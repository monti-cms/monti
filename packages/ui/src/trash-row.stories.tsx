import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListHead } from "./list-head";
import { RowActions, RowLink, Table, TableBody, TableCell, TableRow } from "./table";
import { Text } from "./text";
import { TextButton } from "./text-button";
import { TrashRowDate, TrashRowTitle } from "./trash-row";

/**
 * The two cells that make a trash row: the title cell (title and address, then what it holds) and the date cell (the day it was discarded over the days
 * left). A trashed folder leads with its folder icon.
 */
const meta = {
	title: "Patterns/List/Trash row",
	component: TrashRowTitle,
	args: { title: "첫 번째 글", address: "/first-post", meta: "KO · EN" },
	decorators: [
		(Story) => (
			<div className="w-[880px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof TrashRowTitle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A folder leads with its icon and says what is inside it. */
export const Folder: Story = {
	args: { title: "시리즈 원고", address: undefined, meta: "글 2", folder: true },
};

/** A translation whose original is in the trash says so in the warning tone. */
export const OriginalInTrash: Story = {
	args: {
		title: "React 19 migration",
		address: "/en/react-19",
		meta: "원문이 휴지통에 있어요 · 리액트 19 마이그레이션",
		metaTone: "warning",
	},
};

/** The date over the days left; three days or fewer turn warning. */
export const Dates: Story = {
	render: () => (
		<div className="flex flex-col items-end gap-monti-16">
			<TrashRowDate date="10. 27" left="30일 남음" />
			<TrashRowDate date="09. 30" left="3일 남음" urgent />
		</div>
	),
};

const ROWS = [
	{
		title: "첫 번째 글",
		address: "/first-post",
		meta: "KO · EN",
		kind: "게시글",
		date: "10. 27",
		left: "30일 남음",
	},
	{ title: "시리즈 원고", meta: "글 2", kind: "게시글", date: "10. 27", left: "30일 남음", folder: true },
	{ title: "임시", kind: "태그", date: "09. 30", left: "3일 남음", urgent: true },
];

/** In a list: one head row (title, kind, day), the whole row opens the title's link, the text button and the ⋯ sit above it; an item keeps its empty line. */
export const InAList: Story = {
	render: () => (
		<Table container="none" layout="fixed" columns={[undefined, 112, 128, 120]}>
			<ListHead
				columns={[
					{ id: "title", label: "제목" },
					{ id: "kind", label: "종류", size: 112 },
					{ id: "deletedAt", label: "버린 날", size: 128, align: "end", sort: "desc" },
				]}
				end={120}
			/>
			<TableBody>
				{ROWS.map((row) => (
					<TableRow key={row.title}>
						<TableCell>
							<TrashRowTitle
								title={<RowLink render={<button type="button" />}>{row.title}</RowLink>}
								address={row.address}
								folder={row.folder}
								meta={row.meta}
							/>
						</TableCell>
						<TableCell>
							<Text variant="note" tone="subtle">
								{row.kind}
							</Text>
						</TableCell>
						<TableCell align="end">
							<TrashRowDate date={row.date} left={row.left} urgent={row.urgent} />
						</TableCell>
						<TableCell align="end">
							<RowActions>
								<TextButton>복원</TextButton>
							</RowActions>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	),
};
