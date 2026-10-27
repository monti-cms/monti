import type { Meta, StoryObj } from "@storybook/react-vite";
import { MapRow } from "./map-row";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Stack } from "./stack";

/** One line of "match the fields" in an import: the key from the file, an arrow, and what it goes into. */
const meta = { title: "Controls/MapRow", component: MapRow, args: { name: "title", children: null } } satisfies Meta<
	typeof MapRow
>;
export default meta;
type Story = StoryObj<typeof meta>;

function FieldSelect({ value, proposal = false }: { value: string; proposal?: boolean }) {
	return (
		<Select defaultValue={value}>
			<SelectTrigger size="sm" width="full" proposal={proposal}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="title">제목</SelectItem>
				<SelectItem value="summary">요약</SelectItem>
				<SelectItem value="skip">가져오지 않음</SelectItem>
			</SelectContent>
		</Select>
	);
}

export const Playground: Story = {
	render: () => (
		<MapRow name="title" example="첫 번째 글">
			<FieldSelect value="title" />
		</MapRow>
	),
};

/** An example value, a warning, a key that is not imported, and a match the assistant made. */
export const States: Story = {
	render: () => (
		<Stack gap={0} className="max-w-md">
			<MapRow name="title" example="첫 번째 글">
				<FieldSelect value="title" />
			</MapRow>
			<MapRow name="excerpt" warning="비어 있는 글이 12편 있어요">
				<FieldSelect value="summary" />
			</MapRow>
			<MapRow name="legacy_id" off example="1042">
				<FieldSelect value="skip" />
			</MapRow>
			<MapRow name="intro" example="이 글은…">
				<FieldSelect value="summary" proposal />
			</MapRow>
		</Stack>
	),
};
