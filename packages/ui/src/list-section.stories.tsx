import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Button, ChangeGroup, ChangeNote, ListSection, ListSectionRow, MenuField, Stack } from "./index";

/**
 * A titled list of rows: the title bold with a count, a line under it, then its rows. On a tools page, rows with a meta line and their actions or one control
 * at the end; in a review sheet, the changes (each `role="listitem"`). It keeps no room around itself: the page or sheet spaces its sections.
 */
const meta = {
	title: "Patterns/List/ListSection",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Rows with text buttons, each its own column; the meta line by state: usage, nothing used yet (faint, the title muted), unreadable (danger). Rows with a meta line are 74px. */
export const Keys: Story = {
	render: () => (
		<ListSection title="저장된 키" count={3}>
			<ListSectionRow
				title="Anthropic 개인"
				titleCount="··· a1b2"
				meta="이번 달 1.24M 토큰"
				actions={
					<>
						<Button variant="ghost" size="sm">
							바꾸기
						</Button>
						<Button variant="ghost-danger" size="sm">
							지우기
						</Button>
					</>
				}
			/>
			<ListSectionRow
				title="OpenAI"
				titleCount="··· 9f2c"
				meta="이번 달 사용 없음"
				metaTone="faint"
				muted
				actions={
					<Button variant="ghost-danger" size="sm">
						지우기
					</Button>
				}
			/>
			<ListSectionRow
				title="검색 노출"
				detail="· 검색 키"
				meta="읽을 수 없어요"
				metaTone="danger"
				actions={
					<Button variant="ghost" size="sm">
						바꾸기
					</Button>
				}
			/>
		</ListSection>
	),
};

/** A row that ends in one 320px control, named by the row's title: a title alone is 52px, the control stands in it. */
export const Control: Story = {
	render: () => (
		<ListSection title="모델" count={1} countTone="warning">
			<ListSectionRow
				title="빠른 작업"
				meta="필드 하나 채우기, 대체 텍스트"
				labelId="quick-model"
				control={<MenuField aria-labelledby="quick-model" value="claude-haiku-5-5" meta="Anthropic 개인" mono />}
			/>
		</ListSection>
	),
};

/** A review sheet's groups: what is saved at once and what goes into a pull request. The changes have no inset, so the titles are `flush`, and the list keeps 16px under the line. */
export const ReviewSheet: Story = {
	render: () => (
		<Box width="sheet">
			<Stack gap={24}>
				<ListSection title="바로 저장" count={2} flush>
					<ChangeGroup role="listitem" kind="edit" tag="고침" title="이름과 링크" identifier="사이트 이름">
						<ChangeNote>example.dev</ChangeNote>
					</ChangeGroup>
					<ChangeGroup role="listitem" kind="edit" tag="고침" title="글 쓰는 방식" identifier="말투와 규칙">
						<ChangeNote>숫자는 아라비아 숫자로 쓴다.</ChangeNote>
					</ChangeGroup>
				</ListSection>
				<ListSection title="PR" count={1} flush>
					<ChangeGroup role="listitem" kind="edit" tag="고침" title="미리보기 경로" identifier="site.previewPath" />
				</ListSection>
			</Stack>
		</Box>
	),
};

/** A plugin's key places: the plugin's name (and the place, when it has several), its code under it in mono (`metaMono`: it is written as it is typed), the key field at the end. */
export const PluginKeys: Story = {
	render: () => (
		<ListSection title="플러그인" count={3} countTone="warning">
			<ListSectionRow
				title="바른 맞춤법"
				meta="bareun"
				metaTone="subtle"
				metaMono
				labelId="slot-bareun"
				control={<MenuField aria-labelledby="slot-bareun" placeholder="키 없음" warning />}
			/>
			<ListSectionRow
				title="Algolia 검색"
				detail="검색 키"
				meta="algolia"
				metaTone="subtle"
				metaMono
				labelId="slot-search"
				control={<MenuField aria-labelledby="slot-search" placeholder="키 없음" warning />}
			/>
			<ListSectionRow
				title="Algolia 검색"
				detail="관리 키"
				meta="algolia"
				metaTone="subtle"
				metaMono
				labelId="slot-admin"
				control={<MenuField aria-labelledby="slot-admin" value="Algolia" meta="··· 4410" metaMono />}
			/>
		</ListSection>
	),
};
