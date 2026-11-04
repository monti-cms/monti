import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField, FormFieldLabel, Input, LockMark, Section, Stack } from "./index";

/** One section of a settings screen: the title in a column on the left, the fields beside it, and a hairline under. */
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

/** Two sections; the last has no hairline; a section that is all structure ends its title with a lock. */
export const Sections: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<Section title="사이트">
				{field("site-name", "사이트 이름", "몬티 블로그")}
				{field("site-url", "주소", "https://monti.blog")}
			</Section>
			<Section
				last
				title={
					<>
						언어 <LockMark label="구조는 바꿀 수 없어요" />
					</>
				}
			>
				{field("tz", "시간대", "Asia/Seoul")}
			</Section>
		</Stack>
	),
};

/** `dense`: groups of options in a stacked column (a collection's editor options), 20px apart from their rules. */
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
			<Section title="기본" stacked last>
				{field("col-name", "이름", "게시글")}
			</Section>
		</Stack>
	),
};
