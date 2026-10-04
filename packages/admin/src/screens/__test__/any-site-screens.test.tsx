import {
	adminEntryEditHref,
	COLLECTIONS,
	type Collection,
	createTranslator,
	DEFAULT_COLLECTION,
	DEFAULT_LOCALE,
	isItemCollection,
	schemaOf,
	storedField,
	storedFields,
} from "@monti-cms/core/client";
import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminClientDashboard } from "../admin-dashboard";
import { EntryEditorShell } from "../entries/entry-editor-shell";
import { entryEditorShellMessages } from "../entries/entry-editor-shell.messages";
import { copyTitle } from "../entries/entry-form";
import { entriesMessages } from "../entries/messages";
import { columnLabel, columnsFor, fieldColumnOf } from "../list-columns";
import { screensMessages } from "../messages";
import { RecordPanel } from "../record-panel";
import { AdminQueryProvider } from "../shared/query-provider";

/**
 * 설정과 상관없는 관리자 화면 확인(M10-1 재발 방지). 컬렉션·필드 이름과 이름표를 적지 않고 지금 설정에서 읽는다.
 * 블로그 예시 설정과 다른 사이트 설정(`vitest.othersite.config.ts`) 둘 다로 돈다. 제목 필드 `title`만 이름으로 쓴다.
 */

const t = createTranslator(screensMessages);
const tEntries = createTranslator(entriesMessages);
const tShell = createTranslator(entryEditorShellMessages);

const content: Collection = DEFAULT_COLLECTION;
const record = COLLECTIONS.find((name) => isItemCollection(name)) as Collection;
const titleLabel = (collection: Collection) => storedField(collection, "title")?.field.label ?? "";

const nav = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	const state = {
		search: new URLSearchParams(),
		push: vi.fn(),
		replace: vi.fn(),
		listeners,
		set(query: string) {
			state.search = new URLSearchParams(query);
			for (const listener of listeners) listener();
		},
	};
	return state;
});
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		replace: (url: string) => {
			nav.replace(url);
			nav.set(url.split("?")[1] ?? "");
		},
		push: nav.push,
	}),
	useSearchParams: () =>
		useSyncExternalStore(
			(listener) => {
				nav.listeners.add(listener);
				return () => nav.listeners.delete(listener);
			},
			() => nav.search,
		),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
const backup = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn(), save: vi.fn() }));
vi.mock("../entries/local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../entries/local-backup")>()),
	getLocalBackup: backup.get,
	deleteLocalBackup: backup.remove,
	saveLocalBackup: backup.save,
}));
// 본문 편집기는 따로 시험한다. 여기서는 제목 칸이 들어갈 자리만 그린다.
vi.mock("../../editor/tiptap-editor", () => ({
	CmsEditor: ({ titleField, toolbarEnd }: { titleField?: React.ReactNode; toolbarEnd?: React.ReactNode }) => (
		<>
			<div role="toolbar" aria-label="서식 도구">
				{toolbarEnd}
			</div>
			{titleField}
		</>
	),
}));
vi.mock("../entries/ai-translate", () => ({
	useAiTranslate: () => ({ blockAction: null, toolbar: null, setEditor: () => {} }),
}));

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
type Handler = (url: URL, init: RequestInit | undefined) => unknown;
let handle: Handler = () => undefined;
let listed: ListEntriesItem[] = [];
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => (init?.method ?? "GET") === method && String(input).split("?")[0] === path,
	);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));

const item = (id: string, title: string): ListEntriesItem => ({
	id,
	collection: content,
	locale: DEFAULT_LOCALE,
	translationGroupId: id,
	title,
	slug: id,
	status: "draft",
	version: 1,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	trashedAt: null,
});

beforeEach(() => {
	vi.clearAllMocks();
	backup.get.mockResolvedValue(null);
	backup.remove.mockResolvedValue(undefined);
	backup.save.mockResolvedValue(true);
	handle = () => undefined;
	listed = [];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const handled = await handle(url, init);
		if (handled !== undefined) return handled;
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/cms/v1/preferences") return json({});
		if (url.pathname === "/api/cms/v1/folders" && method === "GET") return json([]);
		if (url.pathname === "/api/cms/v1/entries" && method === "GET") {
			const items = url.searchParams.get("collection") === content ? listed : [];
			return json({ items, total: items.length });
		}
		if (url.pathname.endsWith("/relations")) return json({ incomingReferences: [] });
		throw new Error(`Unexpected fetch: ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("any site: list screen", () => {
	it("shows the collection's rows under its configured list columns", async () => {
		nav.set(`collection=${content}`);
		listed = [item("e1", "Alpha"), item("e2", "Beta")];
		render(
			<AdminQueryProvider>
				<AdminClientDashboard />
			</AdminQueryProvider>,
		);
		await screen.findByRole("row", { name: /Alpha/ });
		expect(screen.getByRole("row", { name: /Beta/ })).toBeTruthy();
		const headers = screen
			.getAllByRole("columnheader")
			.map((header) => header.textContent ?? "")
			.join(" | ");
		for (const column of columnsFor(content).defaults) expect(headers).toContain(columnLabel(content, column));
		// 새 항목 버튼은 컬렉션 이름표를 쓴다.
		expect(screen.getByRole("button", { name: t("list.add", { label: schemaOf(content).label }) })).toBeTruthy();
	});

	// 목록 컬럼에 적은 선택·글자 필드(다른 사이트 설정의 `format`). 없는 설정이면 건너뛴다.
	const listedSelect = columnsFor(content).defaults.flatMap((column) => {
		const stored = fieldColumnOf(content, column);
		return stored?.field.kind === "select" ? [{ column, field: stored.field }] : [];
	})[0];
	it.skipIf(!listedSelect)("draws a listed select field column with the option label", async () => {
		const { column, field } = listedSelect as NonNullable<typeof listedSelect>;
		const [value, label] = Object.entries(field.options)[1] ?? Object.entries(field.options)[0] ?? ["", ""];
		nav.set(`collection=${content}`);
		listed = [{ ...item("e1", "Alpha"), values: { [column]: value } }, item("e2", "Beta")];
		render(
			<AdminQueryProvider>
				<AdminClientDashboard />
			</AdminQueryProvider>,
		);
		const row = await screen.findByRole("row", { name: /Alpha/ });
		expect(within(row).getByText(label)).toBeTruthy();
		// 값이 없는 줄은 빈 칸 표시다.
		expect(within(screen.getByRole("row", { name: /Beta/ })).queryByText(label)).toBeNull();
		expect(
			screen.getAllByRole("columnheader").some((header) => header.textContent?.includes(columnLabel(content, column))),
		).toBe(true);
	});

	it("duplicates a row with a copy title made by the admin", async () => {
		nav.set(`collection=${content}`);
		listed = [item("e1", "Alpha")];
		handle = (url, init) =>
			url.pathname === "/api/cms/v1/entries/e1/duplicate" && init?.method === "POST"
				? json({ id: "copy-1" }, 201)
				: undefined;
		render(
			<AdminQueryProvider>
				<AdminClientDashboard />
			</AdminQueryProvider>,
		);
		const row = await screen.findByRole("row", { name: /Alpha/ });
		await act(async () => {
			fireEvent.contextMenu(row);
		});
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.duplicate") }));
		await waitFor(() => expect(calls("POST", "/api/cms/v1/entries/e1/duplicate")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/cms/v1/entries/e1/duplicate")[0])).toEqual({
			title: copyTitle(content, "Alpha"),
		});
		await waitFor(() => expect(nav.push).toHaveBeenCalledWith(adminEntryEditHref("copy-1")));
	});
});

describe("any site: copy title", () => {
	it("adds the copy suffix and stays within the title field's max", () => {
		expect(copyTitle(content, "Alpha")).toBe(`Alpha${tEntries("copy.suffix")}`);
		expect(copyTitle(content, "  ")).toBe(`${tEntries("untitled")}${tEntries("copy.suffix")}`);
		const field = storedField(content, "title")?.field;
		const max = field?.kind === "text" ? field.max : undefined;
		const long = copyTitle(content, "x".repeat(500));
		if (max === undefined) expect(long).toBe(`${"x".repeat(500)}${tEntries("copy.suffix")}`);
		else {
			expect(Array.from(long)).toHaveLength(max);
			expect(long.endsWith(tEntries("copy.suffix"))).toBe(true);
		}
	});
});

describe("any site: record panel", () => {
	it("creates a record from its title field alone", async () => {
		handle = (url, init) =>
			url.pathname === "/api/cms/v1/entries" && init?.method === "POST"
				? json({ id: "r1", collection: record, status: "published", version: 1, working: { metadata: {}, mdx: "" } })
				: undefined;
		const onSaved = vi.fn();
		render(<RecordPanel target={{ collection: record, id: null }} onClose={vi.fn()} onSaved={onSaved} />);
		const panel = screen.getByRole("complementary", { name: t("list.add", { label: schemaOf(record).label }) });
		fireEvent.change(within(panel).getByRole("textbox", { name: new RegExp(titleLabel(record)) }), {
			target: { value: "New record" },
		});
		fireEvent.click(within(panel).getByRole("button", { name: t("common.save") }));
		await waitFor(() => expect(calls("POST", "/api/cms/v1/entries")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/cms/v1/entries")[0])).toEqual({
			collection: record,
			slug: null,
			metadata: { title: "New record" },
			mdx: "",
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" })));
	});
});

describe("any site: entry editor", () => {
	const entry = {
		id: "entry-1",
		collection: content,
		locale: DEFAULT_LOCALE,
		translationGroupId: "entry-1",
		status: "draft",
		version: 4,
		folderId: null,
		workingSlug: "any-entry",
		publishedSlug: null,
		working: { metadata: { title: "Any title" }, mdx: "Body" },
	};

	it("opens an entry with the title field's label and saves only schema fields", async () => {
		handle = (url, init) => {
			if (url.pathname !== "/api/cms/v1/entries/entry-1") return undefined;
			if (!init?.method) return json(entry);
			if (init.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...entry, version: 5, working: { metadata: body.metadata, mdx: body.mdx } });
			}
			return undefined;
		};
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId="u1" collection={content} />);
		const title = (await screen.findByRole("textbox", { name: titleLabel(content) })) as HTMLInputElement;
		await waitFor(() => expect(title.value).toBe("Any title"));
		// 속성 칸의 첫 묶음 필드가 설정의 이름표로 보인다.
		const first = schemaOf(content).layout?.[0]?.fields ?? [];
		for (const name of first) {
			const field = schemaOf(content).fields[name];
			if (!field || name === "title" || field.kind === "slug" || field.kind === "view") continue;
			expect(screen.getAllByText(field.label).length, name).toBeGreaterThan(0);
		}

		fireEvent.change(title, { target: { value: "Changed title" } });
		fireEvent.click(screen.getByRole("button", { name: tShell("save") }));
		await waitFor(() => expect(calls("PATCH", "/api/cms/v1/entries/entry-1")).toHaveLength(1));
		const body = bodyOf(calls("PATCH", "/api/cms/v1/entries/entry-1")[0]);
		expect(body.metadata.title).toBe("Changed title");
		const known = new Set(storedFields(content).map(({ name }) => name));
		for (const key of Object.keys(body.metadata)) expect(known.has(key), key).toBe(true);
	});
});
