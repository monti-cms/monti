import type { Meta, StoryObj } from "@storybook/react-vite";
import { MenuField } from "./model-menu";
import { TableSection, TableSectionRow } from "./table-section";
import { TextButton } from "./text-button";

/** The tables of the API keys page: a bold label title with a count, then rows with a meta line and either text buttons or one 320px control. */
const meta = {
	title: "Patterns/List/TableSection",
	component: TableSection,
	args: { title: "저장된 키", count: 3, children: null },
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 880 }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof TableSection>;
export default meta;
type Story = StoryObj<typeof meta>;

const actions = (
	<>
		<TextButton type="button" variant="underline">
			편집
		</TextButton>
		<TextButton type="button" variant="quiet">
			지우기
		</TextButton>
	</>
);

export const Keys: Story = {
	render: (args) => (
		<TableSection {...args}>
			<TableSectionRow title="Anthropic 개인" titleCount="··· a1b2" meta="이번 달 1.24M 토큰" actions={actions} />
			<TableSectionRow title="OpenAI 회사" titleCount="··· 77de" meta="이번 달 312K 토큰" actions={actions} />
			<TableSectionRow
				title="예전 Gemini 키"
				titleCount="··· 9f0c"
				meta="이번 달 사용 없음"
				metaTone="faint"
				muted
				actions={actions}
			/>
		</TableSection>
	),
};

export const Unreadable: Story = {
	render: (args) => (
		<TableSection {...args}>
			<TableSectionRow
				title="Anthropic 개인"
				titleCount="··· a1b2"
				meta="읽을 수 없어요"
				metaTone="danger"
				actions={actions}
			/>
		</TableSection>
	),
};

/** Rows that end in one control, named by their title. */
export const WithControl: Story = {
	render: () => (
		<TableSection title="플러그인" count={2} countTone="warning">
			<TableSectionRow
				title="바른 맞춤법"
				meta="bareun"
				metaTone="subtle"
				labelId="slot-bareun"
				control={<MenuField placeholder="키 없음" warning aria-labelledby="slot-bareun" />}
			/>
			<TableSectionRow
				title="Algolia 검색"
				detail="검색 키"
				meta="algolia"
				metaTone="subtle"
				control={<MenuField mono value="claude-haiku-5-5" meta="Anthropic 개인" />}
			/>
		</TableSection>
	),
};
