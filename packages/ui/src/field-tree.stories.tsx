import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldGroup, FieldRow, FieldTree } from "./index";

/** The outline of a collection's fields: one line per field with a grip, the name (mono), the label and the kind at the end. */
const meta = {
	title: "Patterns/List/FieldTree",
	component: FieldTree,
} satisfies Meta<typeof FieldTree>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Fields, a group's grey band and the fields indented under it; a field that cannot be moved has no grip. */
export const Outline: Story = {
	render: () => (
		<FieldTree>
			<FieldRow name="slug !" label="주소" kind="slug" grip={false} />
			<FieldRow name="title !" label="제목" description="목록과 검색 결과에 보여요" kind="text" />
			<FieldRow name="seo" label="검색 노출" group />
			<FieldRow name="seo.title" label="검색 제목" kind="text" depth={1} />
			<FieldRow name="seo.image" label="공유 이미지" kind="image" depth={1} locked="seo 플러그인이 둔 필드" />
			<FieldRow name="tags" label="태그" kind="relation → 태그" />
		</FieldTree>
	),
};

/** Changes before saving: renamed, new, going, and a field with a problem (a red dot after its name). */
export const Changes: Story = {
	render: () => (
		<FieldTree>
			<FieldRow
				name="headline"
				label="제목"
				note="title에서 이름 바꿈"
				tone="warning"
				kind="text"
				changed
				changedLabel="변경"
			/>
			<FieldRow
				name="readingTime"
				label="읽는 시간"
				note="새 필드"
				tone="success"
				kind="number"
				changed
				changedLabel="변경"
			/>
			<FieldRow name="legacyId" label="이전 ID" kind="text" removed />
			<FieldRow name="cover" label="표지" kind="image" tone="danger" problems="고칠 것 2개" />
			<FieldRow name="series" label="시리즈" note="✦ 제안" tone="proposal" kind="→ Series" />
		</FieldTree>
	),
};

/** A line that opens its field: the name is the button. */
export const Openable: Story = {
	render: () => (
		<FieldTree>
			<FieldRow name="title !" label="제목" kind="text" onOpen={() => {}} openLabel="제목 필드 열기" />
			<FieldRow name="summary" label="요약" kind="textarea" onOpen={() => {}} openLabel="요약 필드 열기" />
		</FieldTree>
	),
};

/** A group with its fields as one block: the band's grip moves the group and its fields together. */
export const Group: Story = {
	render: () => (
		<FieldTree>
			<FieldRow name="title !" label="제목" kind="text" />
			<FieldGroup name="검색 노출">
				<FieldRow name="seoTitle" label="검색 제목" kind="text" depth={1} />
				<FieldRow name="seoImage" label="공유 이미지" kind="image" depth={1} />
			</FieldGroup>
			<FieldRow name="tags" label="태그" kind="[] → tag" />
		</FieldTree>
	),
};

/**
 * A field with what hangs under it, beside a group: a conditional field's line, then a band for each of its options one step in (no grip, its value
 * after its name, the way to add a field at its end) and that option's fields one step further. The same inside a group, one step deeper.
 */
export const Branch: Story = {
	render: () => (
		<FieldTree>
			<FieldRow name="title !" label="제목" kind="text" />
			<FieldGroup head={<FieldRow name="format !" label="글 종류" kind="conditional · 2" />}>
				<FieldRow group grip={false} depth={1} name="글" note="article · 필드 없음" />
				<FieldRow group grip={false} depth={1} name="동영상" note="video" />
				<FieldRow grip={false} name="videoUrl !" label="동영상 주소" kind="text" depth={2} />
			</FieldGroup>
			<FieldGroup name="분류">
				<FieldRow name="category" label="카테고리" kind="→ category" depth={1} />
				<FieldGroup head={<FieldRow name="source" label="출처" kind="conditional · 1" depth={1} />}>
					<FieldRow group grip={false} depth={2} name="인용" note="quoted" />
					<FieldRow grip={false} name="sourceUrl" label="출처 주소" kind="text" depth={3} />
				</FieldGroup>
			</FieldGroup>
		</FieldTree>
	),
};

/**
 * While dragging: the line in hand floats over the page (the whole line on the page ground, with the floating shadow, drawn by the `Sortable`
 * overlay), its place stays as a gap, and the line it passed has moved up into its place. A group in hand floats with its fields.
 */
export const Held: Story = {
	render: () => (
		<div className="flex w-[640px] flex-col gap-monti-32">
			<div className="relative">
				<FieldTree>
					<FieldRow name="title !" label="제목" kind="text" />
					<FieldRow
						name="summary"
						label="요약"
						kind="text · 120"
						dragging
						motion={{ transform: "translate3d(0px, 41px, 0)" }}
					/>
					<FieldRow name="cover" label="표지" kind="image" motion={{ transform: "translate3d(0px, -41px, 0)" }} />
					<FieldRow name="tags" label="태그" kind="[] → tag" />
				</FieldTree>
				<div className="absolute inset-x-0 top-[70px]">
					<FieldRow lifted name="summary" label="요약" kind="text · 120" />
				</div>
			</div>
			<div className="relative">
				<FieldTree>
					<FieldRow name="title !" label="제목" kind="text" />
					<FieldGroup name="검색 노출" dragging>
						<FieldRow name="seoTitle" label="검색 제목" kind="text" depth={1} />
						<FieldRow name="seoImage" label="공유 이미지" kind="image" depth={1} />
					</FieldGroup>
					<FieldRow name="tags" label="태그" kind="[] → tag" />
				</FieldTree>
				<div className="absolute inset-x-0 top-[24px]">
					<FieldGroup lifted name="검색 노출">
						<FieldRow name="seoTitle" label="검색 제목" kind="text" depth={1} />
						<FieldRow name="seoImage" label="공유 이미지" kind="image" depth={1} />
					</FieldGroup>
				</div>
			</div>
		</div>
	),
};
