import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

describe("Table options", () => {
	it("sets the computed widths of the table and its columns", () => {
		render(
			<Table width={1200}>
				<TableHeader>
					<TableRow>
						<TableHead size={180}>Title</TableHead>
						<TableHead filler />
					</TableRow>
				</TableHeader>
				<TableBody dimmed>
					<TableRow>
						<TableCell size={180}>Row</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		expect(screen.getByRole("table").style.width).toBe("1200px");
		expect(screen.getAllByRole("columnheader")[0]?.style.width).toBe("180px");
		expect(screen.getByRole("cell").style.width).toBe("180px");
	});
});
