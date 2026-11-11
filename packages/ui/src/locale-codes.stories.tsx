import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { LocaleCodes, Table, TableBody, TableCell, TableRow, TooltipProvider } from "./index";

/** A row's languages in a list's language column: written out while the column has room, counted when it has not. */
const meta = {
	title: "Patterns/List/LocaleCodes",
	component: LocaleCodes,
	tags: ["visual"],
} satisfies Meta<typeof LocaleCodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
	{ codes: ["ko"], names: "한국어" },
	{ codes: ["ko", "en"], names: "한국어, 영어" },
	{ codes: ["ko", "en", "ja", "fr"], names: "한국어, 영어, 일본어, 프랑스어" },
];

/** The same rows in a column of 60px (the kind's width), 96px and 160px. The last column takes the room that is left, so the three keep their widths. */
export const Widths: Story = {
	args: { codes: [], names: "" },
	render: () => (
		<TooltipProvider>
			<Table layout="fixed" columns={[60, 96, 160, undefined]}>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.names}>
							<TableCell>
								<LocaleCodes {...row} />
							</TableCell>
							<TableCell>
								<LocaleCodes {...row} />
							</TableCell>
							<TableCell>
								<LocaleCodes {...row} />
							</TableCell>
							<TableCell />
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TooltipProvider>
	),
};

/** Pointed at while some languages are only counted: the tooltip names them all. */
export const Pointed: Story = {
	args: { codes: ["ko", "en", "ja"], names: "한국어, 영어, 일본어" },
	render: (args) => (
		<TooltipProvider delay={0}>
			<Table layout="fixed" columns={[60, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell>
							<LocaleCodes {...args} />
						</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>
		</TooltipProvider>
	),
	play: async ({ canvasElement }) => {
		await userEvent.hover(await within(canvasElement).findByText("KO +2"));
		await within(document.body).findByRole("tooltip");
	},
};

/** A column too narrow for even one long code: it ends in "…", and the tooltip still names the language. */
export const Cut: Story = {
	args: { codes: ["zh-hans", "en"], names: "중국어(간체), 영어" },
	render: (args) => (
		<TooltipProvider>
			<Table layout="fixed" columns={[60, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell>
							<LocaleCodes {...args} />
						</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>
		</TooltipProvider>
	),
};
