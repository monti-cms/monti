import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList } from "./folder-tabs";
import { Stack } from "./stack";
import { Text } from "./text";

/** Tabs that sit on a box like folder tabs, for a list of fields split into pages. The picked tab joins the box. */
const meta = { title: "Controls/Tabs/FolderTabs", component: FolderTabs } satisfies Meta<typeof FolderTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The add button appends a tab and opens it. The grips show where a tab is dragged by; the admin's field editor wires the dragging. */
export const Playground: Story = {
	render: (args) => <Demo {...args} />,
};

function Demo(props: ComponentProps<typeof FolderTabs>) {
	const [tabs, setTabs] = useState([
		{ id: "content", name: "내용", count: 6, locked: false },
		{ id: "seo", name: "SEO", count: 3, locked: false },
		{ id: "plugin", name: "분석", count: 2, locked: true },
	]);
	const [value, setValue] = useState("content");
	return (
		<FolderTabs {...props} value={value} onValueChange={(next) => setValue(String(next))}>
			<FolderTabsList
				add={
					<FolderTabsAdd
						aria-label="탭 추가"
						onClick={() => {
							const id = `tab-${tabs.length + 1}`;
							setTabs([...tabs, { id, name: `새 탭 ${tabs.length + 1}`, count: 0, locked: false }]);
							setValue(id);
						}}
					/>
				}
			>
				{tabs.map((tab) => (
					<FolderTab key={tab.id} value={tab.id} count={tab.count} locked={tab.locked}>
						{tab.name}
					</FolderTab>
				))}
			</FolderTabsList>
			{tabs.map((tab) => (
				<FolderTabsBody key={tab.id} value={tab.id}>
					<Stack padding={16}>
						<Text tone="muted">{tab.name} 탭의 필드</Text>
					</Stack>
				</FolderTabsBody>
			))}
		</FolderTabs>
	);
}

/** A second tab picked, and a tab that stays where it is (no grip). */
export const SecondPicked: Story = {
	render: () => (
		<FolderTabs defaultValue="seo">
			<FolderTabsList add={<FolderTabsAdd aria-label="탭 추가" />}>
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
