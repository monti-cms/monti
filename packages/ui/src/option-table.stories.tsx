import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { OptionRow, OptionRowHandle, OptionTable } from "./option-table";
import { TextButton } from "./text-button";

const ROWS = [
	{ value: "note", label: "메모" },
	{ value: "essay", label: "에세이" },
	{ value: "review", label: "리뷰" },
];

/**
 * The choices of a select in the add-field sheet: value in mono and label as text until pressed, a handle to reorder and a × to take one out. The button
 * that adds a choice follows the table.
 */
const meta = {
	title: "Primitives/OptionTable",
	component: OptionTable,
	args: { valueLabel: "값", labelLabel: "라벨" },
	decorators: [
		(Story) => (
			<div className="w-[420px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof OptionTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<>
			<OptionTable {...args}>
				{ROWS.map((row) => (
					<OptionRow
						key={row.value}
						handle={<OptionRowHandle aria-label={`끌어서 순서 바꾸기: ${row.value}`} />}
						value={<Input appearance="inline" mono aria-label="값" defaultValue={row.value} />}
						label={<Input appearance="inline" aria-label="라벨" defaultValue={row.label} />}
						action={
							<TextButton quiet aria-label={`${row.value} 빼기`}>
								×
							</TextButton>
						}
					/>
				))}
			</OptionTable>
			<div className="mt-monti-8 flex gap-monti-16 text-monti-note">
				<TextButton>+ 선택지</TextButton>
			</div>
		</>
	),
};
