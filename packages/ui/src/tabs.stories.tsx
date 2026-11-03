import type { Meta, StoryObj } from "@storybook/react-vite";
import { TabLink, TabLinks, Tabs, TabsContent, TabsList, TabsTrigger, Text } from "./index";

/** Underlined text tabs that switch the view in place: language, status, a panel's parts. The picked one is ink at 600 with a 1.5px rule. */
const meta = {
	title: "Controls/Tabs/Tabs",
	component: Tabs,
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `line` (the default): 13px tabs 20px apart. */
export const Line: Story = {
	render: () => (
		<Tabs defaultValue="ko">
			<TabsList>
				<TabsTrigger value="ko">한국어</TabsTrigger>
				<TabsTrigger value="en">English</TabsTrigger>
				<TabsTrigger value="ja">日本語</TabsTrigger>
			</TabsList>
			<TabsContent value="ko">
				<Text variant="note">한국어 원문</Text>
			</TabsContent>
		</Tabs>
	),
};

/** A count after the name in mono; a count that needs attention takes the warning tone; a dot marks a tab with something to handle. */
export const CountsAndDots: Story = {
	render: () => (
		<Tabs defaultValue="all">
			<TabsList>
				<TabsTrigger value="all" count={148}>
					전체
				</TabsTrigger>
				<TabsTrigger value="failed" count={3} countTone="warning" countLabel="실패한 전송 3개">
					실패
				</TabsTrigger>
				<TabsTrigger value="seo" dot="warning" dotLabel="저장하지 않은 변경">
					검색 노출
				</TabsTrigger>
				<TabsTrigger value="ai" dot="proposal" dotLabel="어시스턴트 제안">
					요약
				</TabsTrigger>
			</TabsList>
		</Tabs>
	),
};

/** `bar`: the tab row at the top of a pane, 44px, its underline on the pane's own rule. */
export const Bar: Story = {
	render: () => (
		<Tabs defaultValue="props">
			<TabsList variant="bar">
				<TabsTrigger value="props">속성</TabsTrigger>
				<TabsTrigger value="seo">검색 노출</TabsTrigger>
				<TabsTrigger value="activity">활동</TabsTrigger>
			</TabsList>
		</Tabs>
	),
};

/** `toolbar`: the tabs under a page title, 14px, the picked one bold, no underline. */
export const Toolbar: Story = {
	render: () => (
		<Tabs defaultValue="published">
			<TabsList variant="toolbar">
				<TabsTrigger value="all" count={148}>
					전체
				</TabsTrigger>
				<TabsTrigger value="published" count={120}>
					발행됨
				</TabsTrigger>
				<TabsTrigger value="draft" count={28}>
					초안
				</TabsTrigger>
			</TabsList>
		</Tabs>
	),
};

/** Tabs that go to other pages: links in the tab look, the current one marked. */
export const Links: Story = {
	render: () => (
		<nav>
			<TabLinks variant="toolbar">
				<TabLink href="#" current>
					가져오기
				</TabLink>
				<TabLink href="#">내보내기</TabLink>
				<TabLink href="#" count={2} countTone="warning">
					전달
				</TabLink>
			</TabLinks>
		</nav>
	),
};
