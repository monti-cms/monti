import type { RelationField } from "@monti-cms/core/client";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { EMPTY_FORM } from "../entry-form";
import { EntryPicker, type FieldInputProps, OrderedEntryList } from "../field-inputs";
import { entriesMessages } from "../messages";

const t = testSite.createTranslator(entriesMessages);

/** Label of the relation target (`post`). Input hints use the target collection's label (the collection name if not in config). */
const TARGET = testSite.isCollection("post") ? testSite.schemaOf("post").label : "post";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const POSTS = [
	{ id: "p1", title: "첫 글", status: "published" },
	{ id: "p2", title: "둘째 글", status: "draft" },
	{ id: "p3", title: "셋째 글", status: "published" },
	{ id: "self", title: "지금 글", status: "published" },
];

/** The search requests the pickers sent (the server search is `GET /v1/entries/search`). */
let searches: URL[] = [];

beforeEach(() => {
	searches = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input), "http://localhost");
			if (url.pathname === "/api/cms/v1/entries/search") {
				searches.push(url);
				const ids = url.searchParams.getAll("id");
				const query = (url.searchParams.get("query") ?? "").toLowerCase();
				const items = POSTS.filter((post) =>
					ids.length > 0 ? ids.includes(post.id) : post.title.toLowerCase().includes(query),
				)
					.filter((post) => url.searchParams.get("publishedOnly") !== "true" || post.status === "published")
					.map((post) => ({ ...post, slug: post.id }));
				return json({ items });
			}
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

	it("pressing opens the first posts minus itself, and picking switches to that ID", async () => {
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

describe("relation picker search on the server", () => {
	const field: RelationField = { kind: "relation", label: "최신 글", to: "post" };

	it("asks the server for the typed text after a pause, instead of loading the whole list", async () => {
		render(<EntryPicker {...props(field, null)} />);
		const input = await openList("최신 글");
		await waitFor(() => expect(searches.length).toBeGreaterThan(0));
		// The first request is the first posts of the collection: no text, no paging through everything.
		expect(searches[0]?.searchParams.get("collection")).toBe("post");
		expect(searches[0]?.searchParams.has("query")).toBe(false);

		fireEvent.input(input, { target: { value: "둘째" }, inputType: "insertText" });
		await waitFor(() => expect(searches.at(-1)?.searchParams.get("query")).toBe("둘째"));
		await waitFor(async () => expect(await optionNames()).toEqual([`둘째 글${t("entry.unpublished")}`]));
	});

	it("sends one request for a burst of typing", async () => {
		render(<EntryPicker {...props(field, null)} />);
		const input = await openList("최신 글");
		await waitFor(() => expect(searches.length).toBeGreaterThan(0));
		const before = searches.length;
		for (const text of ["첫", "첫 ", "첫 글"])
			fireEvent.input(input, { target: { value: text }, inputType: "insertText" });
		await waitFor(() => expect(searches.at(-1)?.searchParams.get("query")).toBe("첫 글"));
		expect(searches.length - before).toBe(1);
	});

	it("only asks for published posts when the field says so", async () => {
		render(<EntryPicker {...props({ ...field, publishedOnly: true }, null)} />);
		await openList("최신 글");
		await waitFor(async () => expect(await optionNames()).toEqual(["첫 글", "셋째 글"]));
		expect(searches.every((url) => url.searchParams.get("publishedOnly") === "true")).toBe(true);
	});

	it("keeps the picked post visible when the search does not return it", async () => {
		render(<EntryPicker {...props(field, "p2")} />);
		const input = (await screen.findByRole("combobox", { name: "최신 글" })) as HTMLInputElement;
		await waitFor(() => expect(input.value).toBe(`둘째 글${t("entry.unpublished")}`));
		// It was looked up by id, once, whatever the text says.
		expect(searches.some((url) => url.searchParams.getAll("id").join() === "p2")).toBe(true);
		fireEvent.mouseDown(input);
		fireEvent.input(input, { target: { value: "셋째" }, inputType: "insertText" });
		await waitFor(async () => expect(await optionNames()).toEqual(["셋째 글"]));
	});

	it("names the picked posts of an ordered list by looking them up by id", async () => {
		const many: RelationField = { kind: "relation", label: "게시글", to: "post", many: true, ordered: true };
		render(<OrderedEntryList {...props(many, ["p3", "gone"])} />);
		const list = await screen.findByRole("list", { name: t("entry.listAria", { target: TARGET }) });
		await waitFor(() =>
			expect(
				within(list)
					.getAllByRole("listitem")
					.map((item) => item.textContent),
			).toEqual([
				expect.stringContaining("1. 셋째 글"),
				expect.stringContaining(`2. ${t("entry.missing", { target: TARGET })}`),
			]),
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
