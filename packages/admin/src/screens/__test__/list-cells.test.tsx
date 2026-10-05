import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type CmsAdminComponents,
	CmsAdminComponentsProvider,
	type ListCellProps,
	useCmsAdminComponents,
} from "../../admin-components";

// A site where select, text, media and relation fields are written in the list columns (runs regardless of config).
vi.mock("@monti-cms/core/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@monti-cms/core/client")>();
	const article = {
		label: "Article",
		kind: "document",
		body: true,
		fields: {
			title: { kind: "text", label: "Title" },
			slug: { kind: "slug", label: "Slug", from: "title" },
			format: {
				kind: "select",
				label: "Format",
				options: { news: "News", guide: "Guide" },
				defaultValue: "news",
			},
			subtitle: { kind: "text", label: "Subtitle" },
			accent: { kind: "text", label: "Accent", input: "color" },
			hero: { kind: "media", label: "Hero" },
			related: { kind: "relation", label: "Related", to: "article", many: true },
			lead: { kind: "relation", label: "Lead", to: "article" },
			preview: { kind: "view", view: "preview" },
		},
		list: { columns: ["title", "format", "subtitle", "accent", "hero", "related", "lead", "status"] },
	};
	return {
		...actual,
		isCollection: (name: string) => name === "article" || actual.isCollection(name),
		schemaOf: (name: string) => (name === "article" ? article : actual.schemaOf(name as never)),
		taxonomyFieldsOf: (name: string) => (name === "article" ? [] : actual.taxonomyFieldsOf(name as never)),
	};
});

const { AdminEntriesTable } = await import("../admin-entries-table");
const { columnConfig, columnsFor, fieldColumnOf } = await import("../list-columns");
const { parseListState } = await import("../list-state");

afterEach(cleanup);

const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "article",
	locale: "en",
	translationGroupId: id,
	title: id,
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
	...fields,
});

function renderTable(items: ListEntriesItem[], components: CmsAdminComponents = {}) {
	const props: ComponentProps<typeof AdminEntriesTable> = {
		collection: "article",
		items,
		folders: [],
		explorer: null,
		state: parseListState(new URLSearchParams("collection=article")),
		options: {},
		onStateChange: vi.fn(),
		onColumnSettingsChange: vi.fn(),
		selectedIds: new Set(),
		onSelectionChange: vi.fn(),
		total: items.length,
		isLoading: false,
		errorMessage: null,
		rowMenu: () => [],
		onSelectFolder: vi.fn(),
		onOpenRecord: vi.fn(),
		onPageChange: vi.fn(),
		onPageSizeChange: vi.fn(),
		onRetry: vi.fn(),
	};
	render(
		<CmsAdminComponentsProvider components={components}>
			<AdminEntriesTable {...props} />
		</CmsAdminComponentsProvider>,
	);
}

const rowOf = (name: RegExp) => screen.getByRole("row", { name });

describe("list columns from fields", () => {
	it("offers the listed fields as columns and shows them by default", () => {
		const { available, defaults } = columnsFor("article");
		expect(defaults[0]).toBe("title");
		for (const column of ["format", "subtitle", "accent", "hero", "related", "lead"]) {
			expect(defaults).toContain(column);
			expect(available).toContain(column);
		}
		// Display-only fields that are not stored and fields not written in the list are not columns.
		expect(available).not.toContain("preview");
	});

	it("labels field columns by the field label and never filters them", () => {
		expect(columnConfig("article", "format")).toEqual({ label: "Format", filter: { kind: "none" } });
		expect(columnConfig("article", "related")).toEqual({ label: "Related", filter: { kind: "none" }, many: true });
		expect(fieldColumnOf("article", "format")?.field.kind).toBe("select");
		expect(fieldColumnOf("article", "status")).toBeUndefined();
		expect(fieldColumnOf("article", "preview")).toBeUndefined();
	});
});

describe("default list cells", () => {
	it("draws the select option label, the stored text, the media id and relation names", () => {
		renderTable([
			item("first", {
				values: { format: "guide", subtitle: "A longer subtitle", hero: "media-1" },
				relations: {
					related: [
						{ id: "r1", title: "Alpha" },
						{ id: "r2", title: "Beta" },
					],
					lead: [{ id: "l1", title: "Lead story" }],
				},
			}),
		]);
		const row = rowOf(/first/);
		expect(within(row).getByText("Guide")).toBeTruthy();
		expect(within(row).getByText("A longer subtitle")).toBeTruthy();
		expect(within(row).getByText("media-1")).toBeTruthy();
		expect(within(row).getByText("Lead story")).toBeTruthy();
		expect(within(row).getAllByText("Alpha").length).toBeGreaterThan(0);
	});

	it("shows a dash for empty values and the raw value for a select option that no longer exists", () => {
		renderTable([item("empty"), item("stale", { values: { format: "retired" } })]);
		expect(within(rowOf(/empty/)).getAllByText("—").length).toBeGreaterThanOrEqual(5);
		expect(within(rowOf(/stale/)).getByText("retired")).toBeTruthy();
	});
});

describe("listCells extension", () => {
	it("draws a registered cell for a column name, with the field and stored value", () => {
		const Format = ({ column, field, value, entry }: ListCellProps) => (
			<span data-testid="cell">{`${column}/${field?.kind}/${value}/${entry.id}`}</span>
		);
		renderTable([item("first", { values: { format: "guide" } })], { listCells: { format: Format } });
		expect(within(rowOf(/first/)).getByTestId("cell").textContent).toBe("format/select/guide/first");
		expect(within(rowOf(/first/)).queryByText("Guide")).toBeNull();
	});

	it("falls back to the field's `input` name, and the column name wins over it", () => {
		const Swatch = ({ value }: ListCellProps) => <span data-testid="swatch">{value}</span>;
		const Named = () => <span data-testid="named">named</span>;
		renderTable([item("first", { values: { accent: "#f00" } })], { listCells: { color: Swatch } });
		expect(within(rowOf(/first/)).getByTestId("swatch").textContent).toBe("#f00");
		cleanup();
		renderTable([item("first", { values: { accent: "#f00" } })], { listCells: { color: Swatch, accent: Named } });
		expect(within(rowOf(/first/)).getByTestId("named")).toBeTruthy();
		expect(within(rowOf(/first/)).queryByTestId("swatch")).toBeNull();
	});

	it("can replace a system column cell, and inner providers add to outer ones", () => {
		const Status = ({ entry }: ListCellProps) => <span data-testid="status">{`state:${entry.status}`}</span>;
		const Format = () => <span data-testid="format">fmt</span>;
		renderTable([item("first")], { listCells: { status: Status } });
		expect(within(rowOf(/first/)).getByTestId("status").textContent).toBe("state:draft");
		cleanup();
		render(
			<CmsAdminComponentsProvider components={{ listCells: { status: Status } }}>
				<CmsAdminComponentsProvider components={{ listCells: { format: Format } }}>
					<Probe />
				</CmsAdminComponentsProvider>
			</CmsAdminComponentsProvider>,
		);
		expect(screen.getByTestId("keys").textContent).toBe("status,format");
	});
});

function Probe() {
	const { listCells } = useCmsAdminComponents();
	return <span data-testid="keys">{Object.keys(listCells ?? {}).join(",")}</span>;
}
