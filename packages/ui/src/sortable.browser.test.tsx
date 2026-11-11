import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, dropDrag, middleOf } from "../../../testing/input";
import { render } from "../test/render";
import { DragHandle, Sortable, SortableList, useSortableItem } from "./index";

function Row({ id }: { id: string }) {
	const item = useSortableItem(id);
	return (
		// design-allow: the part's own motion, as a row of a screen passes it on
		<div ref={item.ref} style={item.motion} data-row={id} className="flex h-monti-control-md items-center gap-monti-8">
			<DragHandle {...item.handle} aria-label={`${id} 옮기기`} />
			{id}
		</div>
	);
}

function List() {
	const [items, setItems] = useState(["가", "나", "다", "라"]);
	return (
		<Sortable
			nameOf={(id) => id}
			onDrop={({ active, over }) => {
				if (!over || over.id === active.id) return;
				setItems((now) => {
					const next = now.filter((id) => id !== active.id);
					next.splice(now.indexOf(over.id), 0, active.id);
					return next;
				});
			}}
		>
			<SortableList id="list" items={items}>
				{items.map((id) => (
					<Row key={id} id={id} />
				))}
			</SortableList>
		</Sortable>
	);
}

const row = (id: string) => document.querySelector(`[data-row=${id}]`) as HTMLElement;
const top = (id: string) => Math.round(row(id).getBoundingClientRect().top);
const order = () => [...document.querySelectorAll<HTMLElement>("[data-row]")].map((each) => each.dataset.row);
const grip = (id: string) => page.getByRole("button", { name: `${id} 옮기기` });
/** Draws the list and waits for it. */
async function list() {
	render(<List />);
	await expect.element(grip("나")).toBeVisible();
}
/** Holds a row by its grip and takes it one row down. */
async function holdDown(id: string) {
	const from = middleOf(grip(id).element());
	const height = row(id).getBoundingClientRect().height;
	await dragPath([from, { x: from.x, y: from.y + height }], { hold: true });
	return height;
}

describe("Sortable", () => {
	it("[dragging] [dropped] a row held by its grip follows the pointer, only the row it passes makes room, and it stays where it is let go", async () => {
		await list();
		const before = { 가: top("가"), 나: top("나"), 다: top("다"), 라: top("라") };
		const height = await holdDown("나");
		await expect.poll(() => top("나")).toBe(before.나 + height);
		await expect.poll(() => top("다")).toBe(before.나);
		expect(top("가")).toBe(before.가);
		expect(top("라")).toBe(before.라);
		await dropDrag();
		await expect.poll(order).toEqual(["가", "다", "나", "라"]);
		await expect.poll(() => top("나")).toBe(before.다);
		expect(top("가")).toBe(before.가);
		expect(top("라")).toBe(before.라);
	});

	it("[esc-cancels] Esc while a row is in hand puts it back where it was", async () => {
		await list();
		const before = top("나");
		const height = await holdDown("나");
		await expect.poll(() => top("나")).toBe(before + height);
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => top("나")).toBe(before);
		await dropDrag();
		expect(order()).toEqual(["가", "나", "다", "라"]);
	});

	it("[keys-move] Space lifts a row by its grip, ↓ moves it past the next, Space drops it: the place a drag takes it to", async () => {
		await list();
		(grip("나").element() as HTMLElement).focus();
		await userEvent.keyboard(" ");
		await userEvent.keyboard("{ArrowDown}");
		await expect.poll(() => top("나") - top("다")).toBeGreaterThan(0);
		await userEvent.keyboard(" ");
		await expect.poll(order).toEqual(["가", "다", "나", "라"]);
	});
});
