import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { memo, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	EntryFormProvider,
	type EntryFormValue,
	type FieldState,
	type SlotSource,
	useField,
	useSlotActions,
} from "../../../hooks/public";
import { SlotRegistryProvider } from "../../../slots/registry";
import { docOf } from "../../../test/mdx";
import { EMPTY_FORM, type EntryForm, type EntryFormPatch } from "../entry-form";

afterEach(cleanup);

const baseValue = (overrides: Partial<EntryFormValue> = {}): EntryFormValue => ({
	collection: "post",
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
				collection: "post",
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

describe("useField", () => {
	it("returns the value, definition, label, ids and the change function of one field", () => {
		const setForm = vi.fn();
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: providerWith(baseValue({ form: { ...EMPTY_FORM, title: "Hello" }, setForm })),
		});
		expect(result.current.value).toBe("Hello");
		expect(result.current.label).toBe("제목");
		expect(result.current.required).toBe(true);
		expect(result.current.hidden).toBe(false);
		expect(result.current.definition?.kind).toBe("text");
		expect(result.current.ids).toEqual({ input: "cms-title", error: "cms-title-error" });
		expect(result.current.inputProps).toEqual({ id: "cms-title" });
		expect(result.current.readOnly).toBe(false);
		expect(result.current.readOnlyReason).toBeNull();
		expect(result.current.error).toBeNull();
		expect(result.current.invalid).toBe(false);

		act(() => result.current.setValue("Changed"));
		// A patch of this field only: other keys of the form are the owner's.
		expect(setForm).toHaveBeenCalledWith({ title: "Changed" });
	});

	it("an empty or missing value is null, and a key that is not a schema field still works", () => {
		const { result } = renderHook(() => ({ summary: useField("summary"), tab: useField<string>("title:en") }), {
			wrapper: providerWith(baseValue({ form: { ...EMPTY_FORM, "title:en": "Hi" } })),
		});
		expect(result.current.summary.value).toBeNull();
		expect(result.current.tab.value).toBe("Hi");
		expect(result.current.tab.definition).toBeUndefined();
		expect(result.current.tab.label).toBe("title:en");
		expect(result.current.tab.slotRequest).not.toBeNull();
	});

	it("an issue on the field's path becomes its error, with ids that link the input to it", () => {
		const issues = [
			{ code: "missing_field", path: "title", message: "제목" },
			{ code: "other", path: "summary", message: "x" },
		];
		const { result } = renderHook(() => ({ title: useField("title"), tag: useField("tagIds") }), {
			wrapper: providerWith(baseValue({ issues })),
		});
		const { title, tag } = result.current;
		expect(title.invalid).toBe(true);
		expect(title.error?.code).toBe("missing_field");
		expect(title.error?.message).toBeTruthy();
		expect(title.error?.issue).toBe(issues[0]);
		expect(title.errors).toHaveLength(1);
		expect(title.inputProps).toEqual({
			id: "cms-title",
			"aria-invalid": true,
			"aria-describedby": "cms-title-error",
		});
		expect(tag.error).toBeNull();
		expect(tag.inputProps["aria-describedby"]).toBeUndefined();
	});

	it("a disabled form makes every field read-only and ignores changes", () => {
		const setForm = vi.fn();
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: providerWith(baseValue({ disabled: true, setForm })),
		});
		expect(result.current.readOnly).toBe(true);
		expect(result.current.readOnlyReason).toBe("disabled");
		expect(result.current.inputProps.disabled).toBe(true);
		act(() => result.current.setValue("x"));
		expect(setForm).not.toHaveBeenCalled();
	});

	it("on a translation, a shared field shows the original's value read-only; a per-language field stays editable", () => {
		const setForm = vi.fn();
		const locked = {
			values: { ...EMPTY_FORM, title: "Original title", categoryId: "cat-1" },
			note: "From the original",
		};
		const issues = [{ code: "missing_field", path: "categoryId", message: "x" }];
		const { result } = renderHook(() => ({ category: useField("categoryId"), title: useField<string>("title") }), {
			wrapper: providerWith(
				baseValue({ form: { ...EMPTY_FORM, title: "Own title", categoryId: "other" }, locked, issues, setForm }),
			),
		});
		const { category, title } = result.current;
		expect(category.value).toBe("cat-1");
		expect(category.readOnly).toBe(true);
		expect(category.readOnlyReason).toBe("locked");
		expect(category.lockedNote).toBe("From the original");
		expect(category.required).toBe(false);
		// A locked field has no error and no slot.
		expect(category.error).toBeNull();
		expect(category.slotRequest).toBeNull();
		act(() => category.setValue("changed"));
		expect(setForm).not.toHaveBeenCalled();

		expect(title.value).toBe("Own title");
		expect(title.readOnly).toBe(false);
		expect(title.lockedNote).toBeUndefined();
		act(() => title.setValue("Edited"));
		expect(setForm).toHaveBeenCalledWith({ title: "Edited" });
	});

	it("a field that depends on a conditional field resolves, and the slug is never locked", () => {
		const { result } = renderHook(() => ({ nested: useField("replacementPostId"), slug: useField<string>("slug") }), {
			wrapper: providerWith(baseValue({ locked: { values: EMPTY_FORM, note: "n" } })),
		});
		expect(result.current.nested.definition?.kind).toBe("relation");
		expect(result.current.nested.readOnlyReason).toBe("locked");
		expect(result.current.slug.definition?.kind).toBe("slug");
		expect(result.current.slug.readOnly).toBe(false);
	});

	it("builds the slot request of the field: scope, collection and a context read when the action runs", () => {
		let form: EntryForm = { ...EMPTY_FORM, title: "Title v1", doc: docOf("Body"), tagIds: ["a"] };
		const setForm = vi.fn();
		const { result, rerender } = renderHook(() => useField("tagIds"), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<EntryFormProvider value={baseValue({ form, setForm, entryId: "e1", locale: "ko" })}>
					{children}
				</EntryFormProvider>
			),
		});
		const request = result.current.slotRequest;
		expect(request).toMatchObject({
			slot: "field",
			target: "tagIds",
			collection: "post",
			scope: "e1",
			disabled: false,
		});

		// The values at click time, not those of the render that built the request.
		form = { ...form, title: "Title v2", tagIds: ["a", "b"] };
		rerender();
		expect(result.current.slotRequest).toBe(request);
		expect(request?.getContext()).toEqual({
			collection: "post",
			locale: "ko",
			entryId: "e1",
			title: "Title v2",
			summary: undefined,
			body: form.doc,
			current: ["a", "b"],
		});

		request?.apply("c", "append");
		expect(setForm).toHaveBeenLastCalledWith({ tagIds: ["a", "b", "c"] });
		request?.apply("b", "append");
		expect(setForm).toHaveBeenCalledTimes(1);
		request?.apply("only", "replace");
		expect(setForm).toHaveBeenLastCalledWith({ tagIds: "only" });
	});

	it("a new entry's slot request has the `new` scope", () => {
		const { result } = renderHook(() => useField("title"), { wrapper: providerWith(baseValue()) });
		expect(result.current.slotRequest?.scope).toBe("new");
	});

	it("throws outside an EntryFormProvider", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useField("title"))).toThrow(/EntryFormProvider/);
		error.mockRestore();
	});
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

	it("typing in one field does not re-render the component of another field", () => {
		for (const key of Object.keys(renders)) delete renders[key];
		render(
			<Owner initial={{ ...EMPTY_FORM, title: "a", summary: "b" }}>
				<Probe name="title" />
				<Probe name="summary" />
			</Owner>,
		);
		expect(renders).toEqual({ title: 1, summary: 1 });

		fireEvent.change(screen.getByLabelText("title"), { target: { value: "ab" } });
		expect((screen.getByLabelText("title") as HTMLInputElement).value).toBe("ab");
		expect(renders.title).toBe(2);
		expect(renders.summary).toBe(1);

		fireEvent.change(screen.getByLabelText("summary"), { target: { value: "bc" } });
		expect((screen.getByLabelText("summary") as HTMLInputElement).value).toBe("bc");
		expect(renders.summary).toBe(2);
		expect(renders.title).toBe(2);
	});

	it("a field re-renders when its error or the disabled state changes, others only for what they read", () => {
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
		rerender(<Harness issues={[{ code: "missing_field", path: "title" }]} disabled={false} />);
		expect(renders.title).toBe(2);
		rerender(<Harness issues={[{ code: "missing_field", path: "title" }]} disabled />);
		expect(renders.title).toBeGreaterThan(2);
	});

	it("a component that re-renders with the form never reads a value one step behind", () => {
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

describe("orphaned values", () => {
	it("a change patches the field only, so values of removed fields stay in the form", () => {
		const patches: EntryFormPatch[] = [];
		let latest: EntryForm = EMPTY_FORM;
		function Capture() {
			const field = useField<string>("title");
			const summary = useField<string>("summary");
			return (
				<>
					<input aria-label="title" value={field.value ?? ""} onChange={(e) => field.setValue(e.target.value)} />
					<input aria-label="summary" value={summary.value ?? ""} onChange={(e) => summary.setValue(e.target.value)} />
				</>
			);
		}
		function Reader({ form }: { form: EntryForm }) {
			latest = form;
			return null;
		}
		function Host() {
			const [form, setForm] = useState<EntryForm>({ ...EMPTY_FORM, title: "T", oldField: "kept", oldList: ["a", "b"] });
			return (
				<EntryFormProvider
					value={baseValue({
						form,
						setForm: (patch) => {
							patches.push(patch);
							setForm((current) => ({ ...current, ...patch }));
						},
					})}
				>
					<Capture />
					<Reader form={form} />
				</EntryFormProvider>
			);
		}
		render(<Host />);
		fireEvent.change(screen.getByLabelText("title"), { target: { value: "T2" } });
		fireEvent.change(screen.getByLabelText("summary"), { target: { value: "S" } });
		expect(patches).toEqual([{ title: "T2" }, { summary: "S" }]);
		expect(latest).toMatchObject({ title: "T2", summary: "S", oldField: "kept", oldList: ["a", "b"] });
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
				{slot.actions.map((action) => (
					<button key={action.id} type="button" disabled={slot.disabled} onClick={() => slot.start(action.id)}>
						{action.label}
					</button>
				))}
				{slot.state.status === "running" && <span>working</span>}
				{slot.state.status === "done" &&
					slot.state.result.kind === "candidates" &&
					slot.state.result.items.map((item) => (
						<button key={item.value} type="button" onClick={() => slot.apply(item.value)}>
							use {item.label}
						</button>
					))}
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

	it("edits the value, shows the error linked to the input, and applies an AI suggestion through the slot", async () => {
		const patches: EntryFormPatch[] = [];
		render(
			<SlotRegistryProvider sources={[source]}>
				<Owner
					initial={{ ...EMPTY_FORM, title: "Draft" }}
					onPatch={(patch) => patches.push(patch)}
					issues={[{ code: "missing_field", path: "title", message: "제목" }]}
				>
					<SuggestedTitle />
				</Owner>
			</SlotRegistryProvider>,
		);
		const input = screen.getByLabelText("제목") as HTMLInputElement;
		expect(input.id).toBe("cms-title");
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(screen.getByRole("alert").id).toBe("cms-title-error");

		fireEvent.change(input, { target: { value: "Draft 2" } });
		expect(input.value).toBe("Draft 2");
		expect(patches).toEqual([{ title: "Draft 2" }]);

		// The action's context is read when it runs: the new title.
		fireEvent.click(screen.getByText("Suggest"));
		const candidate = await screen.findByText("use Draft 2 (better)");
		fireEvent.click(candidate);
		await waitFor(() => expect(input.value).toBe("Draft 2 (better)"));
		expect(patches.at(-1)).toEqual({ title: "Draft 2 (better)" });
	});

	it("shows no suggestion button for a field no source attached an action to", () => {
		const hooks: { field?: FieldState } = {};
		function Other() {
			hooks.field = useField("summary");
			const slot = useSlotActions(hooks.field.slotRequest as NonNullable<FieldState["slotRequest"]>);
			return <span>{slot.actions.length} actions</span>;
		}
		render(
			<SlotRegistryProvider sources={[source]}>
				<Owner initial={EMPTY_FORM}>
					<Other />
				</Owner>
			</SlotRegistryProvider>,
		);
		expect(screen.getByText("0 actions")).toBeTruthy();
	});
});
