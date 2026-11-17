import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	FieldRow,
	FieldTree,
	FolderTab,
	FolderTabEdit,
	FolderTabLifted,
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

const add = <FolderTabsAdd aria-label="탭 추가" />;

/** Each tab has a grip, a name and its field count; a tab a plugin placed is locked. `+` at the end adds a tab. */
export const Pages: Story = {
	tags: ["visual"],
	render: () => (
		<FolderTabs defaultValue="content">
			<FolderTabsList add={add}>
				<FolderTab value="content" count={4}>
					내용
				</FolderTab>
				<FolderTab value="meta" count={3}>
					분류
				</FolderTab>
				<FolderTab value="seo" count={2} locked="SEO 플러그인이 둔 탭" draggable={false}>
					검색 노출
				</FolderTab>
			</FolderTabsList>
			<FolderTabsBody value="content">
				<FieldTree>
					<FieldRow name="title" required label="제목" kind="text" />
					<FieldRow name="summary" label="요약" kind="textarea" />
					<FieldRow name="cover" label="표지" kind="image" />
					<FieldRow name="body" label="본문" kind="markdown" />
				</FieldTree>
			</FolderTabsBody>
		</FolderTabs>
	),
};

/** The picked tab while its name is edited in place. */
/** A tab a plugin placed, come to with the keyboard: the tab says why it is locked in its tooltip. */
export const LockedFocused: Story = {
	tags: ["visual"],
	render: Pages.render,
	play: async () => {
		const { userEvent, within } = await import("storybook/test");
		await userEvent.tab();
		await userEvent.keyboard("{ArrowRight}{ArrowRight}");
		await within(document.body).findByRole("tooltip");
	},
};

export const Rename: Story = {
	tags: ["visual"],
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

/**
 * While dragging: the tab in hand floats over the row (page ground, floating shadow, drawn by the `Sortable` overlay) and its place stays as a gap;
 * a field held over the "분류" header marks it as where it goes (`dropTarget`).
 */
export const Held: Story = {
	tags: ["visual"],
	render: () => (
		<div className="relative">
			<FolderTabs defaultValue="content">
				<FolderTabsList add={add}>
					<FolderTab value="content" count={4}>
						내용
					</FolderTab>
					<FolderTab value="meta" count={3} dropTarget>
						분류
					</FolderTab>
					<FolderTab value="seo" count={2} dragging>
						검색 노출
					</FolderTab>
				</FolderTabsList>
				<FolderTabsBody value="content">
					<FieldTree>
						<FieldRow name="title" required label="제목" kind="text" />
						<FieldRow name="summary" label="요약" kind="textarea" />
					</FieldTree>
				</FolderTabsBody>
			</FolderTabs>
			<div className="absolute top-[-6px] left-[230px]">
				<FolderTabLifted count={2}>검색 노출</FolderTabLifted>
			</div>
		</div>
	),
};

/**
 * A full row: the tabs shrink first, their names ending in "…" (and saying themselves whole to the pointer and the keyboard) while the grip, the count and the lock stay
 * whole; a short name keeps its own width. Only when even the shrunk tabs do not fit does the row scroll sideways.
 */
export const Shrunk: Story = {
	tags: ["visual"],
	render: () => (
		<div className="max-w-xl">
			<FolderTabs defaultValue="a">
				<FolderTabsList add={add}>
					<FolderTab value="a" count={4}>
						아주 긴 이름의 첫 번째 탭
					</FolderTab>
					<FolderTab value="b" count={3}>
						분류
					</FolderTab>
					<FolderTab value="c" count={12}>
						아주 긴 이름의 세 번째 탭
					</FolderTab>
					<FolderTab value="d" count={2} locked="SEO 플러그인이 둔 탭" draggable={false}>
						검색 엔진에 보이는 내용
					</FolderTab>
					<FolderTab value="e" count={1}>
						아주 긴 이름의 다섯 번째 탭
					</FolderTab>
				</FolderTabsList>
				<FolderTabsBody value="a">
					<FieldTree>
						<FieldRow name="title" required label="제목" kind="text" />
					</FieldTree>
				</FolderTabsBody>
			</FolderTabs>
		</div>
	),
};
