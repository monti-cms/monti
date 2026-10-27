import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList } from "./folder-tabs";
import { Stack } from "./stack";
import { Text } from "./text";

/** Tabs that sit on a box like folder tabs, for a list of fields split into pages. The picked tab joins the box. */
const meta = { title: "Tabs/FolderTabs", component: FolderTabs } satisfies Meta<typeof FolderTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<FolderTabs defaultValue="content" {...args}>
			<FolderTabsList add={<FolderTabsAdd aria-label="탭 추가">+</FolderTabsAdd>}>
				<FolderTab value="content" count={6}>
					내용
				</FolderTab>
				<FolderTab value="seo" count={3}>
					SEO
				</FolderTab>
				<FolderTab value="plugin" count={2} locked>
					분석
				</FolderTab>
			</FolderTabsList>
			<FolderTabsBody value="content">
				<Stack padding={16}>
					<Text tone="muted">내용 탭의 필드</Text>
				</Stack>
			</FolderTabsBody>
			<FolderTabsBody value="seo">
				<Stack padding={16}>
					<Text tone="muted">SEO 탭의 필드</Text>
				</Stack>
			</FolderTabsBody>
			<FolderTabsBody value="plugin">
				<Stack padding={16}>
					<Text tone="muted">플러그인이 둔 탭의 필드</Text>
				</Stack>
			</FolderTabsBody>
		</FolderTabs>
	),
};

/** A second tab picked, and a tab that stays where it is (no grip). */
export const SecondPicked: Story = {
	render: () => (
		<FolderTabs defaultValue="seo">
			<FolderTabsList add={<FolderTabsAdd aria-label="탭 추가">+</FolderTabsAdd>}>
				<FolderTab value="content" count={6} draggable={false}>
					내용
				</FolderTab>
				<FolderTab value="seo" count={3}>
					SEO
				</FolderTab>
			</FolderTabsList>
			<FolderTabsBody value="content">
				<Stack padding={16}>
					<Text tone="muted">내용 탭의 필드</Text>
				</Stack>
			</FolderTabsBody>
			<FolderTabsBody value="seo">
				<Stack padding={16}>
					<Text tone="muted">SEO 탭의 필드</Text>
				</Stack>
			</FolderTabsBody>
		</FolderTabs>
	),
};
