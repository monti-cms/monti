import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { TooltipProvider } from "../../../ui/tooltip";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { EMPTY_FORM } from "../entry-form";
import { entriesMessages } from "../messages";
import { RemovedFieldsNotice } from "../removed-fields-notice";
import { SchemaFields } from "../schema-fields";
import { EntryFormProvider } from "../use-field";

const t = testSite.createTranslator(entriesMessages);

afterEach(cleanup);

const collection = testSite.COLLECTIONS[0] ?? "";

describe("notice of removed fields", () => {
	it("lists the keys of the values the schema no longer has", () => {
		render(<RemovedFieldsNotice collection={collection} metadata={{ title: "T", oldField: "x", oldList: ["a"] }} />);
		const note = screen.getByRole("note");
		expect(note.textContent).toContain(t("inspector.removed.title"));
		expect(note.textContent).toContain("oldField, oldList");
		expect(note.textContent).not.toContain("title,");
	});

	it("renders nothing when every value has a field", () => {
		const { container } = render(<RemovedFieldsNotice collection={collection} metadata={{ title: "T" }} />);
		expect(container.textContent).toBe("");
	});

	it("renders nothing without metadata or for an unknown collection", () => {
		const { container } = render(
			<>
				<RemovedFieldsNotice collection={collection} metadata={undefined} />
				<RemovedFieldsNotice collection="unknown" metadata={{ oldField: "x" }} />
			</>,
		);
		expect(container.textContent).toBe("");
	});
});

describe("select value that is no longer an option", () => {
	const found = testSite.COLLECTIONS.flatMap((name) =>
		testSite
			.storedFields(name)
			.filter(({ field, when }) => !when && field.kind === "select" && !field.input)
			.map((stored) => ({ collection: name, ...stored })),
	)[0];

	it.skipIf(!found)("shows the stored value marked as no longer an option instead of the default", () => {
		if (!found) return;
		render(
			<TooltipProvider>
				<EntryFormProvider
					value={{
						collection: found.collection,
						form: { ...EMPTY_FORM, [found.name]: "removed-option" },
						setForm: () => {},
					}}
				>
					<SchemaFields include={(group) => group.fields.includes(found.name)} />
				</EntryFormProvider>
			</TooltipProvider>,
		);
		expect(screen.getByRole("combobox").textContent).toContain(t("select.removedOption", { value: "removed-option" }));
	});
});
