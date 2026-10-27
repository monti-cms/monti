import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRow, FieldTree } from "./field-tree";
import { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList } from "./folder-tabs";

/**
 * The outline of a collection's fields: a grip, the key (mono), the label, and the kind at the end. A group is a grey band, and the fields in it
 * are indented. A field that cannot be moved has no grip.
 */
const meta = { title: "List/FieldTree", component: FieldTree } satisfies Meta<typeof FieldTree>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: () => (
		<FieldTree className="max-w-2xl">
			<FieldRow name="title" label="제목" kind="text !" />
			<FieldRow name="slug" label="주소" kind="slug" />
			<FieldRow name="author" label="글쓴이" kind="relation → author" />
			<FieldRow name="status" label="상태" kind="select" />
		</FieldTree>
	),
};

/** A group, the fields in it (indented), a field with an unsaved change, and a field that cannot be moved. */
export const Groups: Story = {
	render: () => (
		<FieldTree className="max-w-2xl">
			<FieldRow name="title" label="제목" kind="text !" />
			<FieldRow name="검색" kind="3개" group />
			<FieldRow name="seoTitle" label="검색 제목" kind="text" nested />
			<FieldRow name="seoImage" label="검색 이미지" kind="media" nested changed changedLabel="바뀜" />
			<FieldRow name="analytics" label="분석" kind="plugin" grip={false} />
		</FieldTree>
	),
};

/** On a collection's tabs: the box has its own border, so the first and last rules go. */
export const InTabs: Story = {
	render: () => (
		<FolderTabs defaultValue="content" className="max-w-2xl">
			<FolderTabsList add={<FolderTabsAdd aria-label="탭 추가">+</FolderTabsAdd>}>
				<FolderTab value="content" count={4}>
					내용
				</FolderTab>
				<FolderTab value="seo" count={2}>
					SEO
				</FolderTab>
			</FolderTabsList>
			<FolderTabsBody value="content">
				<FieldTree>
					<FieldRow name="title" label="제목" kind="text !" />
					<FieldRow name="slug" label="주소" kind="slug" />
					<FieldRow name="body" label="본문" kind="richtext" />
					<FieldRow name="cover" label="대표 이미지" kind="media" />
				</FieldTree>
			</FolderTabsBody>
			<FolderTabsBody value="seo">
				<FieldTree>
					<FieldRow name="seoTitle" label="검색 제목" kind="text" />
					<FieldRow name="seoImage" label="검색 이미지" kind="media" />
				</FieldTree>
			</FolderTabsBody>
		</FolderTabs>
	),
};
