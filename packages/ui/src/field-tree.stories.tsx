import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRow, FieldTree } from "./index";

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
				changedLabel="바뀜"
			/>
			<FieldRow
				name="readingTime"
				label="읽는 시간"
				note="새 필드"
				tone="success"
				kind="number"
				changed
				changedLabel="바뀜"
			/>
			<FieldRow name="legacyId" label="이전 ID" kind="text" removed />
			<FieldRow name="cover" label="표지" kind="image" tone="danger" problems="고칠 것 2개" />
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
