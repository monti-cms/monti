import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { spillingCells } from "../../../../../testing/input";
import * as list from "./list.stories";

const { Main, NarrowColumns } = composeStories(list);

const main = () => page.getByRole("main");
const columnName = (name: string) => main().getByRole("columnheader").getByRole("button", { name, exact: true });

describe("the list's column names", () => {
	it("[reach] a right click on a column's name opens that column's menu, as a right click on a row opens the row's", async () => {
		await Main.run();
		await userEvent.click(columnName("수정일"), { button: "right" });
		const menu = page.getByRole("menu");
		await expect.element(menu.getByRole("menuitem", { name: "열 숨기기" })).toBeVisible();
		await userEvent.click(menu.getByRole("menuitem", { name: "열 숨기기" }));
		await expect.element(columnName("수정일")).not.toBeInTheDocument();
	});

	it("06-1 columns dragged to their narrowest keep their words inside their cells", async () => {
		await NarrowColumns.run();
		await expect.element(columnName("수정일")).toBeVisible();
		expect(spillingCells(main().getByRole("table").element())).toEqual([]);
	});
});
