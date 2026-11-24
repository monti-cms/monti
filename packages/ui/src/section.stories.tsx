import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField, FormFieldLabel, Input, LockMark, Section, Stack, Text } from "./index";

/** One section of a settings screen: the title in a column on the left, the fields beside it. A hairline under each section but the last; stacked sections are parted by space alone. */
const meta = {
	title: "Patterns/Frame/Section",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const field = (id: string, label: string, value: string) => (
	<FormField>
		<FormFieldLabel htmlFor={id}>{label}</FormFieldLabel>
		<Input id={id} defaultValue={value} />
	</FormField>
);

/** Two sections, a hairline between them (the last has none); a locked value carries its lock on its own row, not on the section title. */
export const Sections: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<Section title="사이트">
				{field("site-name", "사이트 이름", "몬티 블로그")}
				{field("site-url", "주소", "https://monti.blog")}
			</Section>
			<Section title="공개 주소" last>
				<FormField>
					<FormFieldLabel>
						주소에 언어 표시
						<LockMark label="바꿀 수 없음" />
					</FormFieldLabel>
					<Text>항상</Text>
				</FormField>
			</Section>
		</Stack>
	),
};

/** `dense`: groups of options in a stacked column (a collection's editor options), 20px above and below each. */
export const Dense: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<Section title="블록" dense>
				{field("blocks", "허용할 블록", "수식, 콜아웃, 탭")}
			</Section>
			<Section title="서식" dense last>
				{field("marks", "허용할 서식", "굵게, 기울임")}
			</Section>
		</Stack>
	),
};

/** `stacked`: the title over the fields, in a column that is already narrow. */
export const Stacked: Story = {
	render: () => (
		<Stack gap={0} width="panel">
			<Section title="기본" stacked>
				{field("col-name", "이름", "게시글")}
			</Section>
		</Stack>
	),
};

/** `layout="grid"`: the settings and tools pages of the 2026-11 redesign, the title and a short line under it in a 200px column. */
export const Grid: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<Section layout="grid" title="사이트" description="사이트 이름과 주소는 공개 화면과 피드에 쓰입니다.">
				{field("grid-site-name", "사이트 이름", "몬티 블로그")}
			</Section>
			<Section layout="grid" title="공개 주소" description="한 번 정하면 바꾸기 어렵습니다." last>
				{field("grid-site-url", "주소", "https://monti.blog")}
			</Section>
		</Stack>
	),
};
