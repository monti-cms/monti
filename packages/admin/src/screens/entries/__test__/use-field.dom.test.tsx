import { SiteProvider } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { memo, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { type CmsIssue, issueLine } from "../../../api/error-message";
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

const TITLE_LABEL = testSite.titleField("post").field.label;

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
		expect(result.current.label).toBe("제목");
		expect(result.current.definition?.kind).toBe("text");
		expect(result.current.ids).toEqual({ input: "cms-title", error: "cms-title-error" });
		expect(result.current.inputProps).toEqual({ id: "cms-title" });

		act(() => result.current.setValue("Changed"));
		// A patch of this field only: other keys of the form are the owner's.
		expect(setForm).toHaveBeenCalledWith({ title: "Changed" });
	});

	it("an issue on the field's path becomes its error, with ids that link the input to it", () => {
		const issues = [
			{ code: "missing_field", path: "title", message: "제목", text: "제목을 입력하세요." },
			{ code: "other", path: "summary", message: "x", text: "x" },
		];
		const { result } = renderHook(() => ({ title: useField("title") }), {
			wrapper: providerWith(baseValue({ issues })),
		});
		const { title } = result.current;
		expect(title.invalid).toBe(true);
		expect(title.error?.message).toBe(issueLine(issues[0] as CmsIssue));
		expect(title.inputProps).toEqual({
			id: "cms-title",
			"aria-invalid": true,
			"aria-describedby": "cms-title-error",
		});
	});

	it("a disabled form makes every field read-only and ignores changes", () => {
		const setForm = vi.fn();
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: providerWith(baseValue({ disabled: true, setForm })),
		});
		expect(result.current.inputProps.disabled).toBe(true);
		act(() => result.current.setValue("x"));
		expect(setForm).not.toHaveBeenCalled();
	});

	it("PLUG-A6 on a translation, a shared field shows the original's value read-only; a per-language field stays editable", () => {
		const setForm = vi.fn();
		const locked = {
			values: { ...EMPTY_FORM, title: "Original title", categoryId: "cat-1" },
			note: "From the original",
		};
		const { result } = renderHook(() => ({ category: useField("categoryId"), title: useField<string>("title") }), {
			wrapper: providerWith(
				baseValue({ form: { ...EMPTY_FORM, title: "Own title", categoryId: "other" }, locked, setForm }),
			),
		});
		const { category, title } = result.current;
		expect(category.value).toBe("cat-1");
		expect(category.readOnlyReason).toBe("locked");
		// A locked field has no slot.
		expect(category.slotRequest).toBeNull();
		act(() => category.setValue("changed"));
		expect(setForm).not.toHaveBeenCalled();

		expect(title.value).toBe("Own title");
		act(() => title.setValue("Edited"));
		expect(setForm).toHaveBeenCalledWith({ title: "Edited" });
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
		rerender(<Harness issues={[{ code: "missing_field", path: "title", text: "t" }]} disabled={false} />);
		expect(renders.title).toBe(2);
		rerender(<Harness issues={[{ code: "missing_field", path: "title", text: "t" }]} disabled />);
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
	it("PLUG-A6 a change patches the field only, so values of removed fields stay in the form", () => {
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

	it("edits the value, shows the error linked to the input, and applies an AI suggestion through the slot", async () => {
		const patches: EntryFormPatch[] = [];
		render(
			<SlotRegistryProvider sources={[source]}>
				<Owner
					initial={{ ...EMPTY_FORM, title: "Draft" }}
					onPatch={(patch) => patches.push(patch)}
					issues={[{ code: "missing_field", path: "title", message: "제목", text: "제목을 입력하세요." }]}
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

	it("the assistant's mark ends when the entry is saved, and a field the assistant did not fill never has it", async () => {
		function Marked({ version }: { version: number }) {
			const title = useField("title");
			const slot = useSlotActions(title.slotRequest as NonNullable<FieldState["slotRequest"]>);
			const summary = useField("summary");
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
		expect(screen.getByText("0 actions")).toBeInTheDocument();
	});
});
