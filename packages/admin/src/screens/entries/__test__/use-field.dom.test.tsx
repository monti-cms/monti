import { SUMMARY_ROLE } from "@monti-cms/core";
import { SiteProvider } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { memo, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale, titleFieldOf } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import {
	EntryFormProvider,
	type EntryFormValue,
	type FieldState,
	useField,
	useSlotActions,
} from "../../../hooks/public";
import { SlotRegistryProvider, type SlotSource } from "../../../slots/registry";
import { docOf } from "../../../test/mdx";
import { renderWithSite as render, renderHookWithSite as renderHook } from "../../../test/site";
import { draftSiteOf } from "../../schema/draft-site";
import { EMPTY_FORM, type EntryForm, type EntryFormPatch } from "../entry-form";

const TITLE_LABEL = titleFieldOf(contentCollection).label;
const FIELDS = testSite.storedFields(contentCollection);
/** A field a translation group shares (shown from the original on a translation), and one each language writes itself. */
const SHARED = FIELDS.find(({ name, field }) => name !== "title" && !field.localized);
const PER_LANGUAGE = FIELDS.find(({ field }) => field.localized === true);
/** A relation field that holds many values: a slot can append to it. */
const MANY = FIELDS.find(({ field, when }) => field.kind === "relation" && field.many === true && !when);
const SUMMARY = testSite.roleField(contentCollection, SUMMARY_ROLE);

afterEach(cleanup);

const baseValue = (overrides: Partial<EntryFormValue> = {}): EntryFormValue => ({
	collection: contentCollection,
	form: { ...EMPTY_FORM },
	setForm: vi.fn(),
	...overrides,
});

const providerWith =
	(value: EntryFormValue) =>
	({ children }: { children: ReactNode }) => <EntryFormProvider value={value}>{children}</EntryFormProvider>;

/** Owns the form like an entry editor does: the provider receives the current values and a merging `setForm`. */
function Owner({
	initial,
	onPatch,
	children,
	...rest
}: {
	initial: EntryForm;
	onPatch?: (patch: EntryFormPatch) => void;
	/** A function builds new elements on every render, like a layout parent that re-renders with the form. */
	children: ReactNode | (() => ReactNode);
} & Partial<EntryFormValue>) {
	const [form, setForm] = useState(initial);
	return (
		<EntryFormProvider
			value={{
				collection: contentCollection,
				form,
				setForm: (patch) => {
					onPatch?.(patch);
					setForm((current) => ({ ...current, ...patch }));
				},
				...rest,
			}}
		>
			{typeof children === "function" ? children() : children}
		</EntryFormProvider>
	);
}

describe("useField in a preview", () => {
	it("PLUG-A3 has no slot actions on a draft site, where nothing may reach a service", () => {
		const draft = draftSiteOf(
			testSite,
			{
				collections: { page: { label: "Page", kind: "document", fields: { title: { kind: "text", label: "Title" } } } },
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
			},
			[],
		);
		if (!draft) throw new Error("the draft should parse");
		const wrapper = ({ children }: { children: ReactNode }) => (
			<SiteProvider site={draft}>
				<EntryFormProvider value={baseValue({ collection: "page" })}>{children}</EntryFormProvider>
			</SiteProvider>
		);
		const { result } = renderHook(() => useField("title"), { wrapper });
		expect(result.current.slotRequest).toBeNull();
	});
});

describe("useField", () => {
	it("PLUG-A6 returns the value, definition, label, ids and the change function of one field", () => {
		const setForm = vi.fn();
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: providerWith(baseValue({ form: { ...EMPTY_FORM, title: "Hello" }, setForm })),
		});
		expect(result.current.value).toBe("Hello");
		expect(result.current.label).toBe(TITLE_LABEL);
		expect(result.current.definition?.kind).toBe("text");
		expect(result.current.ids).toEqual({ input: "cms-title", error: "cms-title-error" });
		expect(result.current.inputProps).toEqual({ id: "cms-title" });

		act(() => result.current.setValue("Changed"));
		// A patch of this field only: other keys of the form are the owner's.
		expect(setForm).toHaveBeenCalledWith({ title: "Changed" });
	});

	it.skipIf(!SHARED || !PER_LANGUAGE)(
		"PLUG-A6 on a translation, a shared field shows the original's value read-only; a per-language field stays editable",
		() => {
			const shared = (SHARED as NonNullable<typeof SHARED>).name;
			const own = (PER_LANGUAGE as NonNullable<typeof PER_LANGUAGE>).name;
			const setForm = vi.fn();
			const locked = {
				values: { ...EMPTY_FORM, [own]: "Original value", [shared]: "from-original" },
				note: "From the original",
			};
			const { result } = renderHook(() => ({ sharedField: useField(shared), ownField: useField<string>(own) }), {
				wrapper: providerWith(
					baseValue({ form: { ...EMPTY_FORM, [own]: "Own value", [shared]: "other" }, locked, setForm }),
				),
			});
			const { sharedField, ownField } = result.current;
			expect(sharedField.value).toBe("from-original");
			expect(sharedField.readOnlyReason).toBe("locked");
			// A locked field has no slot.
			expect(sharedField.slotRequest).toBeNull();
			act(() => sharedField.setValue("changed"));
			expect(setForm).not.toHaveBeenCalled();

			expect(ownField.value).toBe("Own value");
			act(() => ownField.setValue("Edited"));
			expect(setForm).toHaveBeenCalledWith({ [own]: "Edited" });
		},
	);

	it.skipIf(!MANY)(
		"PLUG-A3 builds the slot request of the field: scope, collection and a context read when the action runs",
		() => {
			const name = (MANY as NonNullable<typeof MANY>).name;
			let form: EntryForm = { ...EMPTY_FORM, title: "Title v1", doc: docOf("Body"), [name]: ["a"] };
			const setForm = vi.fn();
			const { result, rerender } = renderHook(() => useField(name), {
				wrapper: ({ children }: { children: ReactNode }) => (
					<EntryFormProvider value={baseValue({ form, setForm, entryId: "e1", locale: defaultLocale })}>
						{children}
					</EntryFormProvider>
				),
			});
			const request = result.current.slotRequest;
			expect(request).toMatchObject({
				slot: "field",
				target: name,
				collection: contentCollection,
				scope: "e1",
				disabled: false,
			});

			// The values at click time, not those of the render that built the request.
			form = { ...form, title: "Title v2", [name]: ["a", "b"] };
			rerender();
			expect(result.current.slotRequest).toBe(request);
			expect(request?.getContext()).toEqual({
				collection: contentCollection,
				locale: defaultLocale,
				entryId: "e1",
				title: "Title v2",
				summary: undefined,
				body: form.doc,
				current: ["a", "b"],
			});

			request?.apply("c", "append");
			expect(setForm).toHaveBeenLastCalledWith({ [name]: ["a", "b", "c"] });
		},
	);
});

describe("subscription of one field", () => {
	const renders: Record<string, number> = {};

	/** A field component built only on the hook, counting its renders. Memoized, like a field row the parent does not need to wake. */
	const Probe = memo(function Probe({ name }: { name: string }) {
		const field = useField<string>(name);
		renders[name] = (renders[name] ?? 0) + 1;
		return (
			<input aria-label={name} value={field.value ?? ""} onChange={(event) => field.setValue(event.target.value)} />
		);
	});

	it("PLUG-A15 a field re-renders when its error or the disabled state changes, others only for what they read", () => {
		for (const key of Object.keys(renders)) delete renders[key];
		const Harness = ({ issues, disabled }: { issues: EntryFormValue["issues"]; disabled: boolean }) => (
			<EntryFormProvider value={baseValue({ issues, disabled })}>
				<Probe name="title" />
			</EntryFormProvider>
		);
		const { rerender } = render(<Harness issues={[]} disabled={false} />);
		expect(renders.title).toBe(1);
		// The same (empty) issue list built again does not wake the field.
		rerender(<Harness issues={[]} disabled={false} />);
		expect(renders.title).toBe(1);
		rerender(<Harness issues={[{ code: "missing_field", path: "title", text: "t" }]} disabled={false} />);
		expect(renders.title).toBe(2);
		rerender(<Harness issues={[{ code: "missing_field", path: "title", text: "t" }]} disabled />);
		expect(renders.title).toBeGreaterThan(2);
	});

	it("PLUG-A6 a component that re-renders with the form never reads a value one step behind", () => {
		const seen: string[] = [];
		function Plain() {
			const field = useField<string>("title");
			seen.push(field.value ?? "");
			return <input aria-label="t" value={field.value ?? ""} onChange={(e) => field.setValue(e.target.value)} />;
		}
		render(<Owner initial={{ ...EMPTY_FORM, title: "ab" }}>{() => <Plain />}</Owner>);
		fireEvent.change(screen.getByLabelText("t"), { target: { value: "axb" } });
		// A stale render would put "ab" back into the controlled input for a pass, which moves the caret.
		expect(seen.slice(1)).not.toContain("ab");
		expect(seen.at(-1)).toBe("axb");
	});
});

describe("a custom field UI built only from the hooks", () => {
	/** Imports nothing but `useField` and `useSlotActions`: label, input, error and the AI suggestions are all drawn here. */
	function SuggestedTitle() {
		const field = useField<string>("title");
		const slot = useSlotActions(
			field.slotRequest ?? { slot: "field", target: "title", getContext: () => ({}), apply: () => {} },
		);
		return (
			<div>
				<label htmlFor={field.ids.input}>{field.label}</label>
				<input {...field.inputProps} value={field.value ?? ""} onChange={(e) => field.setValue(e.target.value)} />
				{field.error && (
					<p id={field.ids.error} role="alert">
						{field.error.message}
					</p>
				)}
				{field.assisted && <span>by the assistant</span>}
				{slot.actions.map((action) => (
					<button key={action.id} type="button" disabled={slot.disabled} onClick={() => void slot.run(action.id)}>
						{action.label}
					</button>
				))}
				{slot.state.status === "running" && <span>working</span>}
			</div>
		);
	}

	const source: SlotSource = ({ slot, target }) =>
		slot === "field" && target === "title"
			? [
					{
						id: "suggest",
						label: "Suggest",
						apply: "replace",
						run: async (context) => ({
							kind: "candidates",
							items: [{ value: `${context.title} (better)`, label: `${context.title} (better)` }],
						}),
					},
				]
			: [];

	it("PLUG-A6 edits the value, shows the error linked to the input, and applies an AI suggestion through the slot", async () => {
		const patches: EntryFormPatch[] = [];
		render(
			<SlotRegistryProvider sources={[source]}>
				<Owner
					initial={{ ...EMPTY_FORM, title: "Draft" }}
					onPatch={(patch) => patches.push(patch)}
					issues={[{ code: "missing_field", path: "title", message: TITLE_LABEL, text: "제목을 입력하세요." }]}
				>
					<SuggestedTitle />
				</Owner>
			</SlotRegistryProvider>,
		);
		const input = screen.getByLabelText(TITLE_LABEL) as HTMLInputElement;
		expect(input.id).toBe("cms-title");
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(screen.getByRole("alert").id).toBe("cms-title-error");

		fireEvent.change(input, { target: { value: "Draft 2" } });
		expect(input.value).toBe("Draft 2");
		expect(patches).toEqual([{ title: "Draft 2" }]);

		// The action's context is read when it runs: the new title. The result goes in at once and counts as the assistant's.
		expect(screen.queryByText("by the assistant")).toBeNull();
		fireEvent.click(screen.getByText("Suggest"));
		await waitFor(() => expect(input.value).toBe("Draft 2 (better)"));
		expect(patches.at(-1)).toEqual({ title: "Draft 2 (better)" });
		expect(screen.getByText("by the assistant")).toBeInTheDocument();

		// Editing the value takes the mark off.
		fireEvent.change(input, { target: { value: "Mine" } });
		expect(screen.queryByText("by the assistant")).toBeNull();
	});

	it.skipIf(!SUMMARY)(
		"ASSIST-F1 the assistant's mark ends when the entry is saved, and a field the assistant did not fill never has it",
		async () => {
			function Marked({ version }: { version: number }) {
				const title = useField("title");
				const slot = useSlotActions(title.slotRequest as NonNullable<FieldState["slotRequest"]>);
				const summary = useField(SUMMARY?.name ?? "");
				return (
					<div>
						<button type="button" onClick={() => void slot.run("suggest")}>
							Suggest
						</button>
						<span>title {String(title.assisted)}</span>
						<span>summary {String(summary.assisted)}</span>
						<span>version {version}</span>
					</div>
				);
			}
			const view = (version: number) => (
				<SlotRegistryProvider sources={[source]}>
					<Owner initial={{ ...EMPTY_FORM, title: "Draft" }} entry={{ version } as never}>
						<Marked version={version} />
					</Owner>
				</SlotRegistryProvider>
			);
			const { rerender } = render(view(1));
			fireEvent.click(screen.getByText("Suggest"));
			await screen.findByText("title true");
			expect(screen.getByText("summary false")).toBeInTheDocument();
			rerender(view(2));
			await screen.findByText("title false");
		},
	);
});
