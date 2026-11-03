import type { Meta, StoryObj } from "@storybook/react-vite";
import { MenuField, TableSection, TableSectionRow, TextButton } from "./index";

/** A titled table of a tools page: the title bold with a count, a line under it, then rows with a meta line and their actions or one control at the end. */
const meta = {
	title: "Patterns/List/TableSection",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Rows with text buttons, each its own column; the meta line by state: usage, nothing used yet (faint, the title muted), unreadable (danger). */
export const Keys: Story = {
	render: () => (
		<TableSection title="저장된 키" count={3}>
			<TableSectionRow
				title="Anthropic 개인"
				titleCount="··· a1b2"
				meta="이번 달 1.24M 토큰"
				actions={
					<>
						<TextButton variant="underline">바꾸기</TextButton>
						<TextButton variant="quiet">지우기</TextButton>
					</>
				}
			/>
			<TableSectionRow
				title="OpenAI"
				titleCount="··· 9f2c"
				meta="이번 달 사용 없음"
				metaTone="faint"
				muted
				actions={<TextButton variant="quiet">지우기</TextButton>}
			/>
			<TableSectionRow
				title="검색 노출"
				detail="· 검색 키"
				meta="읽을 수 없어요"
				metaTone="danger"
				actions={<TextButton variant="underline">바꾸기</TextButton>}
			/>
		</TableSection>
	),
};

/** A row that ends in one 320px control, named by the row's title. */
export const Control: Story = {
	render: () => (
		<TableSection title="모델" count={1} countTone="warning">
			<TableSectionRow
				title="빠른 작업"
				meta="필드 하나 채우기, 대체 텍스트"
				labelId="quick-model"
				control={<MenuField aria-labelledby="quick-model" value="claude-haiku-5-5" meta="Anthropic 개인" mono />}
			/>
		</TableSection>
	),
};
