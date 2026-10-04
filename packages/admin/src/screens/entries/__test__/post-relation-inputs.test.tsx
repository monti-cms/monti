import { isCollection, type RelationField, schemaOf } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FORM } from "../entry-form";
import { EntryPicker, type FieldInputProps, OrderedEntryList } from "../field-inputs";
import { t } from "../translate";

/** Label of the relation target (`post`). Input hints use the target collection's label (the collection name if not in config). */
const TARGET = isCollection("post") ? schemaOf("post").label : "post";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const POSTS = [
	{ id: "p1", title: "첫 글", status: "published" },
	{ id: "p2", title: "둘째 글", status: "draft" },
	{ id: "p3", title: "셋째 글", status: "published" },
	{ id: "self", title: "지금 글", status: "published" },
];

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input), "http://localhost");
			if (url.pathname === "/api/cms/v1/entries") return json({ items: POSTS, total: POSTS.length });
			const one = POSTS.find((post) => url.pathname === `/api/cms/v1/entries/${post.id}`);
			if (one) return json({ status: one.status, working: { metadata: { title: one.title } } });
			throw new Error(`Unexpected fetch ${url}`);
		}),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const props = (field: RelationField, value: FieldInputProps["value"], onChange = vi.fn()): FieldInputProps => ({
	collection: "post",
	form: EMPTY_FORM,
	name: "rel",
	field,
	id: "rel",
	value,
	invalid: false,
	context: { entryId: "self", disabled: false },
	onChange,
});
const openList = async (name: string) => {
	const input = await screen.findByRole("combobox", { name });
	// Base UI opens the list the moment the input is pressed (mousedown).
	await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
	fireEvent.mouseDown(input);
	return input;
};
const optionNames = async () => (await screen.findAllByRole("option")).map((option) => option.textContent);

describe("replacement post (single relation)", () => {
	const field: RelationField = { kind: "relation", label: "최신 글", to: "post" };

	it("pressing opens the full post list minus itself, and picking switches to that ID", async () => {
		const onChange = vi.fn();
		render(<EntryPicker {...props(field, null, onChange)} />);
		await openList("최신 글");

		await waitFor(async () =>
			expect(await optionNames()).toEqual(["첫 글", `둘째 글${t("entry.unpublished")}`, "셋째 글"]),
		);
		fireEvent.click(screen.getByRole("option", { name: "셋째 글" }));
		expect(onChange).toHaveBeenCalledWith("p3");
	});

	it("shows the picked post's title", async () => {
		render(<EntryPicker {...props(field, "p1")} />);
		await waitFor(() =>
			expect((screen.getByRole("combobox", { name: "최신 글" }) as HTMLInputElement).value).toBe("첫 글"),
		);
	});
});

describe("collection post list (ordered multi relation)", () => {
	const field: RelationField = { kind: "relation", label: "게시글", to: "post", many: true, ordered: true };

	it("shows number and title in saved order and flags unpublished posts", async () => {
		render(<OrderedEntryList {...props(field, ["p3", "p2"])} />);
		const list = await screen.findByRole("list", { name: t("entry.listAria", { target: TARGET }) });
		await waitFor(() =>
			expect(
				within(list)
					.getAllByRole("listitem")
					.map((item) => item.textContent),
			).toEqual([expect.stringContaining("1. 셋째 글"), expect.stringContaining("2. 둘째 글")]),
		);
		expect(within(list).getByText(t("entry.unpublished").trim())).toBeTruthy();
	});

	it("checking in the add/remove posts list appends it, and unchecking removes it", async () => {
		const onChange = vi.fn();
		const { rerender } = render(<OrderedEntryList {...props(field, ["p3"], onChange)} />);
		await openList(t("entry.editList", { target: TARGET }));
		fireEvent.click(await screen.findByRole("option", { name: "첫 글" }));
		expect(onChange).toHaveBeenLastCalledWith(["p3", "p1"]);

		rerender(<OrderedEntryList {...props(field, ["p3", "p1"], onChange)} />);
		fireEvent.click(await screen.findByRole("option", { name: "셋째 글" }));
		expect(onChange).toHaveBeenLastCalledWith(["p1"]);
	});

	it("up, down and remove buttons change the order and the list", async () => {
		const onChange = vi.fn();
		render(<OrderedEntryList {...props(field, ["p1", "p2", "p3"], onChange)} />);
		fireEvent.click(await screen.findByRole("button", { name: t("entry.up", { title: "셋째 글" }) }));
		expect(onChange).toHaveBeenLastCalledWith(["p1", "p3", "p2"]);
		fireEvent.click(screen.getByRole("button", { name: t("entry.remove", { title: "첫 글" }) }));
		expect(onChange).toHaveBeenLastCalledWith(["p2", "p3"]);
	});

	it("each item has a handle for dragging", async () => {
		render(<OrderedEntryList {...props(field, ["p1", "p2"])} />);
		expect(await screen.findByRole("button", { name: t("entry.drag", { title: "첫 글" }) })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("entry.drag", { title: "둘째 글" }) })).toBeTruthy();
	});
});
