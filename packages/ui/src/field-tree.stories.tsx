import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRow, FieldTree } from "./field-tree";
import { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList } from "./folder-tabs";

/**
 * The outline of a collection's fields: a grip, the key (mono), the label, and the kind at the end. A group is a grey band, and the fields in it
 * are indented. A field that cannot be moved has no grip.
 */
const meta = { title: "Patterns/List/FieldTree", component: FieldTree } satisfies Meta<typeof FieldTree>;
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
			<FieldRow name="seoTitle" label="검색 제목" kind="text" depth={1} />
			<FieldRow name="seoImage" label="검색 이미지" kind="media" depth={1} changed changedLabel="바뀜" />
			<FieldRow name="analytics" label="분석" kind="plugin" grip={false} />
		</FieldTree>
	),
};

/** What a draft changes, in the list: a renamed field (warning ink, the old name in the note), a field that goes (struck through), a new one (success ink) and one that cannot be saved (danger ink, what is missing). */
export const Marks: Story = {
	render: () => (
		<FieldTree className="max-w-2xl">
			<FieldRow name="title !" label="제목" note="속성 패널에 안 나옴" kind="text" />
			<FieldRow name="excerpt" label="요약" note="← summary" tone="warning" kind="text · 120" />
			<FieldRow name="subtitle" label="부제" note="지움" removed kind="text" />
			<FieldRow name="format !" label="글 종류" note="새로" tone="success" kind="select" />
			<FieldRow name="kind" label="종류" note="선택지 없음" tone="danger" kind="select" />
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
