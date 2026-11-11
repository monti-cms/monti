import type { Meta, StoryObj } from "@storybook/react-vite";
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

/** The same rows in a column of 60px (the kind's width), 96px and 160px. */
export const Widths: Story = {
	args: { codes: [], names: "" },
	render: () => (
		<TooltipProvider>
			<Table layout="fixed" columns={[60, 96, 160]}>
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
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TooltipProvider>
	),
};
