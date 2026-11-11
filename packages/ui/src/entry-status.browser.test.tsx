import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { EntryStatus, Inline, Stack, Table, TableBody, TableCell, TableRow, Text } from "./index";

const status = () => page.getByText("발행됨").element().closest("[data-slot=entry-status]") as HTMLElement;

describe("EntryStatus", () => {
	it("stays whole in a row of things short of room: what stands beside it gives way", async () => {
		render(
			<Stack width="panel">
				<Inline>
					<EntryStatus status="published">발행됨</EntryStatus>
				</Inline>
				<Inline gap={12}>
					<Text mono variant="meta" truncate>
						/posts/a-very-long-address-that-does-not-fit-in-the-head-of-the-editor-however-wide
					</Text>
					<EntryStatus status="published">발행됨</EntryStatus>
				</Inline>
			</Stack>,
		);
		await expect.element(page.getByText("발행됨").first()).toBeVisible();
		const [alone, beside] = page
			.getByText("발행됨")
			.elements()
			.map((name) => name.closest("[data-slot=entry-status]")?.getBoundingClientRect().width);
		expect(beside).toBe(alone);
	});

	it("in a table cell that cuts its words, its name is cut inside the cell and its mark stays", async () => {
		render(
			<Table layout="fixed" columns={[60, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell truncate title="발행됨">
							<EntryStatus status="published">발행됨</EntryStatus>
						</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>,
		);
		await expect.element(page.getByText("발행됨")).toBeVisible();
		const cell = status().closest("td") as HTMLElement;
		expect(status().getBoundingClientRect().right).toBeLessThanOrEqual(cell.getBoundingClientRect().right);
		const name = page.getByText("발행됨").element();
		expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		expect(status().querySelector("[data-slot=entry-status-mark]")?.getBoundingClientRect().width).toBe(7);
	});
});
