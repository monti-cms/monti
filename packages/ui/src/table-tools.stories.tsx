import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, EditorBody, Stack, TableAddStrip, TableGrip } from "./index";

/**
 * A table's tools in the editor: the grips on the caret's column and row, and the + strips along its right and bottom edges. The editor places them
 * over the table with `EditorOverlay`; here they stand on their own.
 */
const meta = {
	title: "Monti/EditorTools/TableTools",
	component: TableGrip,
	args: { along: "column", label: "2번째 열" },
} satisfies Meta<typeof TableGrip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The two grips, quiet. */
export const Grips: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<TableGrip along="column" label="2번째 열" />
			<TableGrip along="row" label="3번째 행" />
		</Stack>
	),
};

/** A grip whose menu is open: ink. */
export const GripActive: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<TableGrip along="column" label="2번째 열" active />
			<TableGrip along="row" label="3번째 행" active />
		</Stack>
	),
};

/** The + strips fill the box they are put in: a tall one for a column, a wide one for a row. */
export const AddStrips: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="start">
			{/* design-allow: the size the editor gives the strip, the table's edge */}
			<div style={{ width: 16, height: 96 }}>
				<TableAddStrip label="열 더하기" />
			</div>
			{/* design-allow: the size the editor gives the strip, the table's edge */}
			<div style={{ width: 320, height: 16 }}>
				<TableAddStrip label="행 더하기" />
			</div>
		</Stack>
	),
};

/** The editor's table: a light grid, the head row only bolder. */
export const Grid: Story = {
	render: () => (
		<Box maxWidth="reading">
			<EditorBody>
				<table>
					<tbody>
						<tr>
							<th>버전</th>
							<th>바뀐 것</th>
							<th>날짜</th>
						</tr>
						<tr>
							<td>1.0</td>
							<td>처음 공개</td>
							<td>2024-03-02</td>
						</tr>
						<tr>
							<td>2.0</td>
							<td className="selectedCell">편집기 다시 만들기</td>
							<td>2025-11-20</td>
						</tr>
					</tbody>
				</table>
			</EditorBody>
		</Box>
	),
};
