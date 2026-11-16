import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { StatusBar, StatusBarCell, StatusBarList, StatusBarListGroup, TodoItem } from "./index";

describe("the status bar's list", () => {
	it("[TP-04] what blocks and what only tells are two groups: each head has its name and its count in its own colour, and the group is named for a screen reader", async () => {
		render(
			<StatusBar aria-label="상태">
				<StatusBarList
					trigger={<StatusBarCell tone="warning">할 일 3</StatusBarCell>}
					label="발행 전에 고칠 것"
					count={1}
					countTone="danger"
					defaultOpen
				>
					<TodoItem title="제목 쓰기" blocking onOpen={() => {}} />
					<StatusBarListGroup label="확인할 것" count={2}>
						<TodoItem title="발행 안 된 글로 가는 링크 1개" onOpen={() => {}} />
						<TodoItem title="검색 제목 60자 넘음" onOpen={() => {}} />
					</StatusBarListGroup>
				</StatusBarList>
			</StatusBar>,
		);
		const group = page.getByRole("group", { name: "확인할 것 2" });
		await expect.element(group).toBeVisible();
		const heads = [...document.querySelectorAll("[data-slot=status-bar-list-head]")] as HTMLElement[];
		expect(heads.map((head) => head.textContent)).toEqual(["발행 전에 고칠 것1", "확인할 것2"]);
		const ink = (head: HTMLElement | undefined) =>
			getComputedStyle(head?.querySelector("[data-slot=count]") as HTMLElement).color;
		// The count over the rows that block is their ring's red; the one over the rows that only tell is not.
		const ring = (title: string) =>
			getComputedStyle(
				page
					.getByRole("button", { name: title })
					.element()
					.closest("[data-slot=todo-item]")
					?.querySelector("[data-slot=todo-mark]") as HTMLElement,
			).borderTopColor;
		expect(ink(heads[0])).toBe(ring("제목 쓰기"));
		expect(ink(heads[0])).not.toBe(ink(heads[1]));
		// The rows of the second group are inside it, under the rule; the blocking row is above it.
		expect(group.element().querySelectorAll("[data-slot=todo-item]")).toHaveLength(2);
		expect(group.element().querySelector("[data-blocking]")).toBeNull();
	});
});
