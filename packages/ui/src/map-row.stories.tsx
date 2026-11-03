import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	IssueRow,
	MapRow,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Text,
} from "./index";

/** A row of "match the fields" in an import: the key from the file, an arrow, the field it goes into, and an example or a warning under it. */
const meta = {
	title: "Patterns/List/MapRow",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const FIELDS = [
	{ value: "title", label: "제목" },
	{ value: "publishedAt", label: "발행한 날" },
	{ value: "tags", label: "태그" },
	{ value: "skip", label: "가져오지 않음" },
];

const pick = (value: string, proposal = false) => (
	<Select items={FIELDS} defaultValue={value}>
		<SelectTrigger width="full" size="sm" proposal={proposal}>
			<SelectValue />
		</SelectTrigger>
		<SelectContent>
			{FIELDS.map((field) => (
				<SelectItem key={field.value} value={field.value}>
					{field.label}
				</SelectItem>
			))}
		</SelectContent>
	</Select>
);

/** An example, a warning, a match the assistant made (blue), and a key that is not imported (dimmed). */
export const Rows: Story = {
	render: () => (
		<Stack gap={0} width="sheet">
			<MapRow name="title" example="봄에 쓴 첫 글">
				{pick("title")}
			</MapRow>
			<MapRow name="date" warning="날짜 3개를 읽을 수 없어요">
				{pick("publishedAt")}
			</MapRow>
			<MapRow name="labels" example="회고, 에디터">
				{pick("tags", true)}
			</MapRow>
			<MapRow name="legacy_id" example="8812" off>
				{pick("skip")}
			</MapRow>
		</Stack>
	),
};

/** What keeps a backup from being restored: one row per problem, its name with the identifier in mono, what it touches in the warning color. */
export const Issues: Story = {
	render: () => (
		<Box width="sheet">
			<Stack gap={16}>
				<Text>문제가 2개 있어서 복원하지 않아요.</Text>
				<div>
					<IssueRow name="이 사이트에 없는 필드" code="series" warning="글 14편이 이 값을 가지고 있어요" />
					<IssueRow name="겹치는 주소" code="/about" warning="두 글이 같은 주소를 써요" />
				</div>
			</Stack>
		</Box>
	),
};
