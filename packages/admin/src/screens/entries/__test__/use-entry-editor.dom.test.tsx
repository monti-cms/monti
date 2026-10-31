import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { memo, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type EntryEditorClient,
	EntryEditorProvider,
	type RecoveryStore,
	type UseEntryEditorOptions,
	useEntryEditor,
	useEntryEditorContext,
	useField,
} from "../../../hooks/public";
import { fakeApi } from "../../../test/fake-api";
import { renderWithSite as render } from "../../../test/site";
import { ENTRY, fakeClient, fakeRecoveryStore, invalidError } from "./entry-editor-fakes";

/**
 * A minimal editor built only from what `@monti-cms/admin` exports: `useEntryEditor`, `EntryEditorProvider`, `useEntryEditorContext` and
 * `useField`. It is the proof that a site can draw its own editor UI: no default shell, no ui/* component, no next/*, no `fetch`.
 */

beforeEach(() => {
	// The editor talks to the injected client only. A real request would be a bug.
	// The editor must use the injected client: a fake that answers nothing fails the test on any request.
	fakeApi().install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function TitleInput() {
	const field = useField<string>("title");
	return (
		<>
			<input
				aria-label="title"
				{...field.inputProps}
				value={field.value}
				onChange={(event) => field.setValue(event.target.value)}
			/>
			{field.error && <p role="alert">{field.error.message}</p>}
		</>
	);
}

function Bar() {
	const editor = useEntryEditorContext();
	const [message, setMessage] = useResult();
	return (
		<div>
			<output aria-label="status">{editor.saveStatus}</output>
			<output aria-label="entry-status">{editor.entry?.status}</output>
			<button type="button" onClick={async () => setMessage(await editor.save())}>
				save
			</button>
			<button type="button" onClick={async () => setMessage(await editor.publish())}>
				publish
			</button>
			{message && <output aria-label="result">{message}</output>}
			{editor.saveError && <p role="alert">{`${editor.saveError.code}: ${editor.saveError.message}`}</p>}
			{editor.conflict && (
				<div role="dialog" aria-label="conflict">
					<button type="button" onClick={() => void editor.overwriteWithMine()}>
						overwrite
					</button>
				</div>
			)}
		</div>
	);
}

function useResult() {
	const [message, setMessage] = useState<string | null>(null);
	return [
		message,
		(result: { ok: boolean; error?: { code: string } }) =>
			setMessage(result.ok ? "ok" : `failed: ${result.error?.code}`),
	] as const;
}

function MinimalEditor(
	options: Partial<UseEntryEditorOptions> & { client: EntryEditorClient; recoveryStore: RecoveryStore },
) {
	const editor = useEntryEditor({ adminId: "u1", target: { mode: "edit", entryId: "entry-1" }, ...options });
	if (editor.load.status === "loading") return <p>loading</p>;
	if (editor.load.status === "redirect") return <p>{`redirect to ${editor.load.collection}/${editor.load.entryId}`}</p>;
	if (editor.load.status === "error")
		return <p role="alert">{`${editor.load.error.code}: ${editor.load.error.message}`}</p>;
	return (
		<EntryEditorProvider editor={editor}>
			<TitleInput />
			<Bar />
		</EntryEditorProvider>
	);
}

const renderMinimal = (options: { server?: typeof ENTRY } & Partial<UseEntryEditorOptions> = {}) => {
	const { server, ...rest } = options;
	const fake = fakeClient(server);
	const recovery = fakeRecoveryStore();
	const view = render(<MinimalEditor client={fake.client} recoveryStore={recovery.store} {...rest} />);
	return { ...fake, recovery, ...view };
};
const title = () => screen.findByLabelText("title") as Promise<HTMLInputElement>;
const status = () => screen.getByLabelText("status").textContent;

describe("a minimal editor on useEntryEditor and useField", () => {
	it("WRITE-S1 loads the entry into the field, edits it locally and saves it through the client", async () => {
		const { client } = renderMinimal();
		expect(screen.getByText("loading")).toBeInTheDocument();
		const input = await title();
		expect(input.value).toBe("테스트");
		expect(status()).toBe("saved");

		fireEvent.change(input, { target: { value: "내 수정" } });
		expect(status()).toBe("dirty");
		expect(client.update).not.toHaveBeenCalled();

		fireEvent.click(screen.getByText("save"));
		await waitFor(() => expect(screen.getByLabelText("result").textContent).toBe("ok"));
		expect(status()).toBe("saved");
		expect(client.update).toHaveBeenCalledWith("entry-1", expect.objectContaining({ expectedVersion: 4 }));
	});

	it("WRITE-P2 publishes through a command, and the new status reaches the screen", async () => {
		renderMinimal();
		await title();
		fireEvent.click(screen.getByText("publish"));
		await waitFor(() => expect(screen.getByLabelText("entry-status").textContent).toBe("published"));
	});

	it("WRITE-C3 a conflict is state: overwrite saves on top of the server's version, with no page reload", async () => {
		const { server } = renderMinimal();
		const input = await title();
		server.current = { ...ENTRY, version: 9, working: { ...ENTRY.working, metadata: { title: "남의 수정" } } };
		const href = window.location.href;
		fireEvent.change(input, { target: { value: "내 수정" } });
		fireEvent.click(screen.getByText("save"));

		await screen.findByRole("dialog", { name: "conflict" });
		expect(status()).toBe("conflict");
		expect(screen.getByLabelText("result").textContent).toBe("failed: conflict");

		fireEvent.click(screen.getByText("overwrite"));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "conflict" })).toBeNull());
		await waitFor(() => expect(status()).toBe("saved"));
		expect(window.location.href).toBe(href);
	});

	it("WRITE-R1 writes the recovery copy when the page is hidden, never touching the server", async () => {
		const { recovery, client } = renderMinimal();
		fireEvent.change(await title(), { target: { value: "떠나기 전" } });
		expect(recovery.store.put).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(recovery.store.put).toHaveBeenCalledTimes(1));
		expect(recovery.records.get("u1:entry-1")?.snapshot.title).toBe("떠나기 전");
		expect(client.update).not.toHaveBeenCalled();
	});

	it("WRITE-S6 asks the browser to confirm leaving only while the server lacks changes, and not when warnOnLeave is off", async () => {
		const leave = () => {
			const event = new Event("beforeunload", { cancelable: true });
			window.dispatchEvent(event);
			return event.defaultPrevented;
		};
		renderMinimal();
		const input = await title();
		expect(leave()).toBe(false);
		fireEvent.change(input, { target: { value: "수정" } });
		expect(leave()).toBe(true);
		fireEvent.click(screen.getByText("save"));
		await waitFor(() => expect(status()).toBe("saved"));
		expect(leave()).toBe(false);
		cleanup();

		renderMinimal({ warnOnLeave: false });
		fireEvent.change(await title(), { target: { value: "수정" } });
		expect(leave()).toBe(false);
	});

	it("WRITE-P1 publish issues reach the field that has them", async () => {
		const { client } = renderMinimal();
		const input = await title();
		client.publish.mockRejectedValueOnce(
			invalidError([{ code: "required", path: "title", message: "title is required", text: "title is required" }]),
		);
		fireEvent.click(screen.getByText("publish"));
		await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
		expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("title is required"))).toBe(true);
	});

	it("TRASH-T7 a trashed entry is read-only in the field", async () => {
		renderMinimal({ server: { ...ENTRY, status: "trashed" } });
		const input = await title();
		expect(input.disabled).toBe(true);
	});
});

describe("selectors", () => {
	it("a component that selects one value re-renders only when it changes, while the form is typed in", async () => {
		const renders = vi.fn();
		// A memoized component is rendered again only by what it selects, not by its parent re-rendering with every change.
		const StatusOnly = memo(function StatusOnly() {
			const saveStatus = useEntryEditorContext((editor) => editor.saveStatus);
			renders(saveStatus);
			return <output aria-label="only-status">{saveStatus}</output>;
		});
		function Editor() {
			const editor = useEntryEditor({
				adminId: "u1",
				target: { mode: "edit", entryId: "entry-1" },
				client: fake.client,
				recoveryStore: fakeRecoveryStore().store,
			});
			if (editor.load.status !== "ready") return null;
			return (
				<EntryEditorProvider editor={editor}>
					<TitleInput />
					<StatusOnly />
				</EntryEditorProvider>
			);
		}
		const fake = fakeClient();
		render(<Editor />);
		const input = await title();
		const base = renders.mock.calls.length;
		fireEvent.change(input, { target: { value: "가" } });
		expect(screen.getByLabelText("only-status").textContent).toBe("dirty");
		const afterFirst = renders.mock.calls.length;
		expect(afterFirst).toBeGreaterThan(base);
		fireEvent.change(input, { target: { value: "가나" } });
		fireEvent.change(input, { target: { value: "가나다" } });
		// Typing more changes the form, not the status: the component is not rendered again.
		expect(renders.mock.calls.length).toBe(afterFirst);
	});
});
