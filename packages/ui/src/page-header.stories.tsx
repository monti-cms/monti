import type { Meta, StoryObj } from "@storybook/react-vite";
import { BulkBar } from "./bulk-bar";
import { Button } from "./button";
import { Caret } from "./caret";
import { Count } from "./count";
import { FilterButton } from "./filter-button";
import { PageBody, PageColumn, PageHeader, PageToolbar, PageToolbarEnd, ToolbarDivider } from "./page-header";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { TextButton } from "./text-button";

/**
 * The top of a content page: the title (26px bold) with the one ink rule of the page, its address rule in mono beside it, and the page's actions
 * on the right (the secondary pill, then the one primary pill). Under it the toolbar holds the tabs and filters.
 */
const meta = {
	title: "Patterns/Frame/PageHeader",
	component: PageHeader,
	args: { title: "게시글", meta: "/posts/:slug" },
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<PageHeader {...args}>
			<Button variant="secondary">검색</Button>
			<Button>+ 새 글 쓰기</Button>
		</PageHeader>
	),
};

/** A settings page: no address, and the save group sits where the actions are. */
export const Settings: Story = {
	args: { title: "설정", meta: undefined },
	render: (args) => (
		<PageHeader {...args}>
			<TextButton>
				바뀐 곳 <Count tone="warning">2</Count>
				<Caret />
			</TextButton>
			<TextButton>모두 되돌리기</TextButton>
			<Button>저장하고 적용</Button>
		</PageHeader>
	),
};

/** Without actions, and with a title that does not fit: it wraps and the actions go under it. */
export const Narrow: Story = {
	render: (args) => (
		<div className="max-w-sm">
			<PageHeader {...args} title="여름 여행 기록과 이사 후기를 모아 둔 아주 긴 이름의 목록">
				<Button variant="secondary">검색</Button>
				<Button>+ 새 글 쓰기</Button>
			</PageHeader>
		</div>
	),
};

function Filters() {
	return (
		<PageToolbarEnd>
			<FilterButton>태그</FilterButton>
			<FilterButton>언어</FilterButton>
			<ToolbarDivider />
			<FilterButton>최근 수정순</FilterButton>
		</PageToolbarEnd>
	);
}

/** The row under the title, as a list page has it (12px inside, like the rows): tabs on the left, the filters used most and the sort on the right, with a short rule between the groups. */
export const Toolbar: Story = {
	parameters: { bleed: true },
	render: () => (
		<PageToolbar inset>
			<Tabs defaultValue="all">
				<TabsList variant="toolbar" aria-label="상태">
					<TabsTrigger value="all" count={148}>
						전체
					</TabsTrigger>
					<TabsTrigger value="published">발행됨</TabsTrigger>
					<TabsTrigger value="draft">초안</TabsTrigger>
				</TabsList>
			</Tabs>
			<Filters />
		</PageToolbar>
	),
};

/** Rows picked: the same place becomes the bulk bar, with the same inset, so the first letter does not move. */
export const Picked: Story = {
	parameters: { bleed: true },
	render: () => (
		<BulkBar label="3개 선택" clearLabel="고르기 끝" onClear={() => {}}>
			<TextButton>발행</TextButton>
			<TextButton>폴더로 옮기기</TextButton>
			<TextButton>태그 붙이기</TextButton>
		</BulkBar>
	),
};

/** A page inside a folder: the way back sits above the title, and the title row keeps its 36px. */
export const Trail: Story = {
	args: { title: "Blog Assets", meta: undefined },
	render: (args) => (
		<PageHeader {...args} trail={<span>미디어 /</span>}>
			<Button variant="secondary">검색</Button>
			<Button>올리기</Button>
		</PageHeader>
	),
};

/** The header and the toolbar together, as a list page starts, in the column every page sits in. The body under them is what scrolls. */
export const Page: Story = {
	parameters: { bleed: true },
	render: (args) => (
		<div className="flex h-96">
			<PageColumn>
				<PageHeader {...args}>
					<Button variant="secondary">검색</Button>
					<Button>+ 새 글 쓰기</Button>
				</PageHeader>
				<PageToolbar inset>
					<Tabs defaultValue="all">
						<TabsList variant="toolbar" aria-label="상태">
							<TabsTrigger value="all" count={148}>
								전체
							</TabsTrigger>
							<TabsTrigger value="published">발행됨</TabsTrigger>
							<TabsTrigger value="draft">초안</TabsTrigger>
						</TabsList>
					</Tabs>
					<Filters />
				</PageToolbar>
				<PageBody>
					{Array.from({ length: 12 }, (_, index) => (
						<p key={index} className="m-0 border-monti-muted border-b py-monti-12 text-monti-body">
							{index + 1}번째 줄
						</p>
					))}
				</PageBody>
			</PageColumn>
		</div>
	),
};
