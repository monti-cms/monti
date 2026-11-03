import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Calendar, Image, Link, ListBoxes, TextShortParagraph } from "./icons";
import { Box, PickList, PickListItem, PickListLabel, PickListSeparator } from "./index";

/** Menu rows without the floating card, placed on a sheet: pick one kind to go to the next step. The picked row keeps the selected ground. */
const meta = {
	title: "Controls/Menu/PickList",
	component: PickList,
	args: { "aria-label": "필드 종류" },
} satisfies Meta<typeof PickList>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The kind of a new field. */
export const Kinds: Story = {
	render: (args) => (
		<Box width="menu">
			<PickList {...args}>
				<PickListItem selected>
					<TextShortParagraph />
					텍스트
				</PickListItem>
				<PickListItem>
					<ListBoxes />
					선택
				</PickListItem>
				<PickListItem>
					<Calendar />
					날짜
				</PickListItem>
				<PickListItem>
					<Image />
					미디어
				</PickListItem>
				<PickListItem mark={<ArrowRight />}>
					<Link />
					다른 글 연결
				</PickListItem>
			</PickList>
		</Box>
	),
};

/** Groups with a name and a wider rule between them; a short note at the end of a row goes in `mark`. */
export const Groups: Story = {
	args: { "aria-label": "서비스" },
	render: (args) => (
		<Box width="menu">
			<PickList {...args}>
				<PickListLabel>AI</PickListLabel>
				<PickListItem selected>Anthropic</PickListItem>
				<PickListItem>OpenAI</PickListItem>
				<PickListItem mark="Ollama">로컬 모델</PickListItem>
				<PickListSeparator />
				<PickListLabel>플러그인</PickListLabel>
				<PickListItem mark="seo">검색 노출</PickListItem>
			</PickList>
		</Box>
	),
};
