import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { Box, CutWords, Inline, Stack, Table, TableBody, TableCell, TableRow } from "./index";

/** Words cut to their box with "…": pointed at, or come to with the keyboard, they say themselves whole in a tooltip. */
const meta = {
	title: "Primitives/CutWords",
	component: CutWords,
	tags: ["visual"],
} satisfies Meta<typeof CutWords>;
export default meta;
type Story = StoryObj<typeof meta>;

const LONG = "리액트 19 마이그레이션에서 서버 컴포넌트와 액션을 옮기며 배운 것";

/** In a narrow box the words end in "…"; in a wide one they are whole and say nothing more. */
export const Widths: Story = {
	render: () => (
		<Stack gap={8}>
			<Box width="menu">
				<Inline minWidth={0}>
					<CutWords>{LONG}</CutWords>
				</Inline>
			</Box>
			<Inline minWidth={0}>
				<CutWords>{LONG}</CutWords>
			</Inline>
		</Stack>
	),
};

/** Pointed at while cut: the tooltip says the words whole, and wraps them. */
export const Pointed: Story = {
	render: () => (
		<Box width="menu">
			<Inline minWidth={0}>
				<CutWords>{LONG}</CutWords>
			</Inline>
		</Box>
	),
	play: async ({ canvasElement }) => {
		await userEvent.hover(within(canvasElement).getByText(LONG));
	},
};

/** With `stop`, the words are a stop of the Tab key while they are cut: the keyboard alone reads them whole (a banner's sentence). */
export const KeyboardStop: Story = {
	render: () => (
		<Box width="menu">
			<Inline minWidth={0}>
				<CutWords stop>{LONG}</CutWords>
			</Inline>
		</Box>
	),
	play: async () => {
		await userEvent.tab();
	},
};

/** A table's cut cell is the box itself (`TableCell title`): its value is said whole while the column is too narrow for it. */
export const Cell: Story = {
	render: () => (
		<Table layout="fixed" columns={[96, undefined]}>
			<TableBody>
				<TableRow>
					<TableCell tone="subtle" truncate title="프런트엔드 개발 이야기">
						프런트엔드 개발 이야기
					</TableCell>
					<TableCell />
				</TableRow>
			</TableBody>
		</Table>
	),
	play: async ({ canvasElement }) => {
		await userEvent.hover(within(canvasElement).getByText("프런트엔드 개발 이야기"));
	},
};
