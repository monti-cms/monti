import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { DropdownMenuItem } from "./dropdown-menu";
import { ListHead } from "./list-head";
import { Table } from "./table";

const head = (menu: boolean) => (
	<Table container="none" layout="fixed" columns={[120, undefined, 48]}>
		<ListHead
			columns={[
				{ id: "status", label: "상태", menu: menu ? <DropdownMenuItem>초안</DropdownMenuItem> : undefined },
				{ id: "title", label: "제목" },
			]}
			end={48}
			moveLabel="열 옮기기"
			onPlace={() => {}}
		/>
	</Table>
);

it("a name that opens a menu on a press shows the hand of a press, though it moves on a drag", async () => {
	render(head(true));
	const name = page.getByRole("button", { name: "상태" });
	await expect.element(name).toBeVisible();
	expect(getComputedStyle(name.element()).cursor).toBe("pointer");
});

it("a name that only moves shows the grab hand", async () => {
	render(head(false));
	const name = page.getByRole("button", { name: "제목" });
	await expect.element(name).toBeVisible();
	expect(getComputedStyle(name.element()).cursor).toBe("grab");
});
