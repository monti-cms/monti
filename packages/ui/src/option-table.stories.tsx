import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { DragHandle } from "./drag-handle";
import { Input } from "./input";
import { OptionRow, OptionTable } from "./option-table";

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
						handle={<DragHandle aria-label={`끌어서 순서 바꾸기: ${row.value}`} />}
						value={<Input appearance="inline" mono aria-label="값" defaultValue={row.value} />}
						label={<Input appearance="inline" aria-label="라벨" defaultValue={row.label} />}
						action={
							<Button variant="ghost" size="xs" aria-label={`${row.value} 빼기`}>
								×
							</Button>
						}
					/>
				))}
			</OptionTable>
			<div className="mt-monti-8 flex gap-monti-16 text-monti-note">
				<Button variant="ghost" size="sm">
					+ 선택지
				</Button>
			</div>
		</>
	),
};

/** While dragging: the choice in hand floats (page ground, floating shadow, drawn by the `Sortable` overlay), its place stays as a gap, and the one it passed has moved up. */
export const Held: Story = {
	render: (args) => (
		<div className="relative">
			<OptionTable {...args}>
				{ROWS.map((row, index) => (
					<OptionRow
						key={row.value}
						handle={<DragHandle aria-label={`끌어서 순서 바꾸기: ${row.value}`} />}
						value={<Input appearance="inline" mono aria-label="값" defaultValue={row.value} />}
						label={<Input appearance="inline" aria-label="라벨" defaultValue={row.label} />}
						drag={
							index === 0
								? { transform: "translate3d(0px, 37px, 0)", active: true }
								: index === 1
									? { transform: "translate3d(0px, -37px, 0)" }
									: undefined
						}
					/>
				))}
			</OptionTable>
			<div className="absolute inset-x-0 top-[66px]">
				<OptionRow
					drag={{ lifted: true }}
					handle={<DragHandle aria-hidden tabIndex={-1} />}
					value={<Input appearance="inline" mono aria-label="값" defaultValue="note" />}
					label={<Input appearance="inline" aria-label="라벨" defaultValue="메모" />}
				/>
			</div>
		</div>
	),
};
