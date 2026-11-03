import { Add } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Button,
	FilterButton,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	SearchBox,
	Separator,
	TabLink,
	TabLinks,
	Text,
	TextButton,
} from "./index";

/**
 * The head of a content page: the title (26px bold) over the ink rule, the only heavy line of a page; the list's address rule in mono beside it; the
 * actions at the right, the secondary pill first and the one primary pill last. Under it the 48px toolbar.
 */
const meta = {
	title: "Patterns/Frame/PageHeader",
	parameters: { bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A list page: the address rule and the actions. A collection list has no toolbar, so the column names come right under the rule. */
export const List: Story = {
	render: () => (
		<PageColumn width="list">
			<PageHeader title="게시글" meta="/posts/:slug">
				<Button variant="secondary">가져오기</Button>
				<Button>
					<Add />새 글
				</Button>
			</PageHeader>
			<PageBody>
				<Text variant="note">목록</Text>
			</PageBody>
		</PageColumn>
	),
};

/** A folder: the way back above the title. */
export const Trail: Story = {
	render: () => (
		<PageColumn width="list">
			<PageHeader title="뉴스" trail={<TextButton variant="quiet">게시글 /</TextButton>} />
		</PageColumn>
	),
};

/** The toolbar: tab links on the left; on the right, past a short rule, the search and a filter. */
export const Toolbar: Story = {
	render: () => (
		<PageColumn width="content">
			<PageHeader title="도구" />
			<PageToolbar>
				<nav>
					<TabLinks variant="toolbar">
						<TabLink href="#" current>
							가져오기
						</TabLink>
						<TabLink href="#">내보내기</TabLink>
						<TabLink href="#">전달</TabLink>
					</TabLinks>
				</nav>
				<PageToolbarEnd>
					<Separator orientation="vertical" length="control" flush />
					<SearchBox value="" onValueChange={() => {}} aria-label="찾기" placeholder="찾기" />
					<FilterButton>기간</FilterButton>
				</PageToolbarEnd>
			</PageToolbar>
		</PageColumn>
	),
};
