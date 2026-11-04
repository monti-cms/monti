import type { Meta, StoryObj } from "@storybook/react-vite";
import { Add } from "./icons";
import {
	FieldRow,
	FieldTree,
	FolderTab,
	FolderTabEdit,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	Input,
} from "./index";

/** Tabs on a box like folder tabs, for a field list split into pages: the picked tab joins the box, the others are closed and grey. */
const meta = {
	title: "Controls/Tabs/FolderTabs",
	component: FolderTabs,
} satisfies Meta<typeof FolderTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

const add = (
	<FolderTabsAdd aria-label="탭 추가">
		<Add />
	</FolderTabsAdd>
);

/** Each tab has a grip, a name and its field count; a tab a plugin placed is locked. `+` at the end adds a tab. */
export const Pages: Story = {
	render: () => (
		<FolderTabs defaultValue="content">
			<FolderTabsList add={add}>
				<FolderTab value="content" count={4}>
					내용
				</FolderTab>
				<FolderTab value="meta" count={3}>
					분류
				</FolderTab>
				<FolderTab value="seo" count={2} locked draggable={false}>
					검색 노출
				</FolderTab>
			</FolderTabsList>
			<FolderTabsBody value="content">
				<FieldTree>
					<FieldRow name="title !" label="제목" kind="text" />
					<FieldRow name="summary" label="요약" kind="textarea" />
					<FieldRow name="cover" label="표지" kind="image" />
					<FieldRow name="body" label="본문" kind="markdown" />
				</FieldTree>
			</FolderTabsBody>
		</FolderTabs>
	),
};

/** The picked tab while its name is edited in place. */
export const Rename: Story = {
	render: () => (
		<FolderTabs defaultValue="meta">
			<FolderTabsList add={add}>
				<FolderTab value="content" count={4}>
					내용
				</FolderTab>
				<FolderTabEdit>
					<Input aria-label="탭 이름" defaultValue="분류" size="inherit" width="fit" />
				</FolderTabEdit>
			</FolderTabsList>
			<FolderTabsBody value="meta">
				<FieldTree>
					<FieldRow name="category" label="카테고리" kind="relation" />
				</FieldTree>
			</FolderTabsBody>
		</FolderTabs>
	),
};
