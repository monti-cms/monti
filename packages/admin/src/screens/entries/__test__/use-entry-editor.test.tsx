import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
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
import {
	ENTRY,
	fakeClient,
	fakeRecoveryStore,
	invalidError,
	recoveryCopy,
	unauthorizedError,
} from "./entry-editor-fakes";

/**
 * A minimal editor built only from what `@monti-cms/admin/hooks` exports: `useEntryEditor`, `EntryEditorProvider`, `useEntryEditorContext` and
 * `useField`. It is the proof that a site can draw its own editor UI: no default shell, no ui/* component, no next/*, no `fetch`.
 */

beforeEach(() => {
	// The editor talks to the injected client only. A real request would be a bug.
	vi.stubGlobal(
		"fetch",
		vi.fn(() => {
			throw new Error("The editor must use the injected client, not fetch");
		}),
	);
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
			<button type="button" onClick={async () => setMessage(await editor.changeStatus("archive"))}>
				archive
			</button>
			{message && <p data-testid="result">{message}</p>}
			{editor.saveError && <p role="alert">{`${editor.saveError.code}: ${editor.saveError.message}`}</p>}
			{editor.recovery && (
				<div role="dialog" aria-label="recovery">
					<span>{editor.recovery.kind}</span>
					<button type="button" onClick={editor.restoreRecovery}>
						restore
					</button>
					<button type="button" onClick={() => void editor.discardRecovery()}>
						keep server
					</button>
				</div>
			)}
			{editor.conflict && (
				<div role="dialog" aria-label="conflict">
					<span>{`server v${editor.conflict.server.version}`}</span>
					<button type="button" onClick={() => void editor.overwriteWithMine()}>
						overwrite
					</button>
					<button type="button" onClick={() => void editor.reload()}>
						reload
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

const renderMinimal = (
	options: { server?: typeof ENTRY; records?: ReturnType<typeof recoveryCopy>[] } & Partial<UseEntryEditorOptions> = {},
) => {
	const { server, records, ...rest } = options;
	const fake = fakeClient(server);
	const recovery = fakeRecoveryStore(records);
	const view = render(<MinimalEditor client={fake.client} recoveryStore={recovery.store} {...rest} />);
	return { ...fake, recovery, ...view };
};
const title = () => screen.findByLabelText("title") as Promise<HTMLInputElement>;
const status = () => screen.getByLabelText("status").textContent;

describe("a minimal editor on useEntryEditor and useField", () => {
	it("loads the entry into the field, edits it locally and saves it through the client", async () => {
		const { client } = renderMinimal();
		expect(screen.getByText("loading")).toBeTruthy();
		const input = await title();
		expect(input.value).toBe("테스트");
		expect(status()).toBe("saved");

		fireEvent.change(input, { target: { value: "내 수정" } });
		expect(status()).toBe("dirty");
		expect(client.update).not.toHaveBeenCalled();

		fireEvent.click(screen.getByText("save"));
		await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("ok"));
		expect(status()).toBe("saved");
		expect(client.update).toHaveBeenCalledWith("entry-1", expect.objectContaining({ expectedVersion: 4 }));
	});

	it("publishes and changes the status through commands that return results", async () => {
		const { client } = renderMinimal();
		await title();
		fireEvent.click(screen.getByText("publish"));
		await waitFor(() => expect(screen.getByLabelText("entry-status").textContent).toBe("published"));
		expect(client.publish).toHaveBeenCalledWith("entry-1", { expectedVersion: 4 });

		fireEvent.click(screen.getByText("archive"));
		await waitFor(() => expect(screen.getByLabelText("entry-status").textContent).toBe("archived"));
	});

	it("a conflict is state: overwrite saves on top of the server's version, with no page reload", async () => {
		const { client, server } = renderMinimal();
		const input = await title();
		server.current = { ...ENTRY, version: 9, working: { ...ENTRY.working, metadata: { title: "남의 수정" } } };
		const href = window.location.href;
		fireEvent.change(input, { target: { value: "내 수정" } });
		fireEvent.click(screen.getByText("save"));

		await screen.findByRole("dialog", { name: "conflict" });
		expect(status()).toBe("conflict");
		expect(screen.getByText("server v9")).toBeTruthy();
		expect(screen.getByTestId("result").textContent).toBe("failed: conflict");

		fireEvent.click(screen.getByText("overwrite"));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "conflict" })).toBeNull());
		await waitFor(() => expect(status()).toBe("saved"));
		expect(client.update).toHaveBeenLastCalledWith("entry-1", expect.objectContaining({ expectedVersion: 9 }));
		expect(server.current.working.metadata.title).toBe("내 수정");
		expect(window.location.href).toBe(href);
	});

	it("a conflict is state: reload loads the server's version into the field, with no page reload", async () => {
		const { client, server } = renderMinimal();
		const input = await title();
		server.current = { ...ENTRY, version: 9, working: { ...ENTRY.working, metadata: { title: "남의 수정" } } };
		fireEvent.change(input, { target: { value: "내 수정" } });
		fireEvent.click(screen.getByText("save"));
		await screen.findByRole("dialog", { name: "conflict" });

		client.update.mockClear();
		fireEvent.click(screen.getByText("reload"));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "conflict" })).toBeNull());
		await waitFor(() => expect(input.value).toBe("남의 수정"));
		expect(status()).toBe("saved");
		expect(client.update).not.toHaveBeenCalled();
	});

	it("session expiry and being offline are results and state, not exceptions", async () => {
		const { client } = renderMinimal();
		const input = await title();
		client.update.mockRejectedValueOnce(unauthorizedError());
		fireEvent.change(input, { target: { value: "만료" } });
		fireEvent.click(screen.getByText("save"));
		await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("failed: session_expired"));
		expect(status()).toBe("session-expired");
		expect(screen.getByRole("alert").textContent).toBe("session_expired: sign in again");

		client.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		fireEvent.click(screen.getByText("save"));
		await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("failed: offline"));
		await waitFor(() => expect(status()).toBe("local-only"));
	});

	it("offers a recovery copy found on open; restoring puts it into the field", async () => {
		const copy = recoveryCopy(ENTRY, { title: "임시 저장한 제목" });
		renderMinimal({ records: [copy] });
		const input = await title();
		const dialog = await screen.findByRole("dialog", { name: "recovery" });
		expect(dialog.textContent).toContain("restore");
		expect(input.value).toBe("테스트");

		fireEvent.click(screen.getByRole("button", { name: "restore" }));
		await waitFor(() => expect(input.value).toBe("임시 저장한 제목"));
		expect(screen.queryByRole("dialog", { name: "recovery" })).toBeNull();
		expect(status()).toBe("dirty");
	});

	it("keeping the server's version deletes the recovery copy", async () => {
		const { recovery } = renderMinimal({ records: [recoveryCopy(ENTRY, { title: "임시" })] });
		const input = await title();
		fireEvent.click(await screen.findByText("keep server"));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "recovery" })).toBeNull());
		expect(input.value).toBe("테스트");
		expect(recovery.records.size).toBe(0);
	});

	it("writes the recovery copy when the page is hidden, never touching the server", async () => {
		const { recovery, client } = renderMinimal();
		fireEvent.change(await title(), { target: { value: "떠나기 전" } });
		expect(recovery.store.put).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(recovery.store.put).toHaveBeenCalledTimes(1));
		expect(recovery.records.get("u1:entry-1")?.snapshot.title).toBe("떠나기 전");
		expect(client.update).not.toHaveBeenCalled();
	});

	it("asks the browser to confirm leaving only while the server lacks changes, and not when warnOnLeave is off", async () => {
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

	it("says redirect for an item collection instead of navigating", async () => {
		renderMinimal({ server: { ...ENTRY, collection: "tag" } });
		expect(await screen.findByText("redirect to tag/entry-1")).toBeTruthy();
	});

	it("says why a load failed, as an EditorError", async () => {
		const fake = fakeClient();
		fake.client.get.mockRejectedValueOnce(unauthorizedError());
		render(<MinimalEditor client={fake.client} recoveryStore={fakeRecoveryStore().store} />);
		expect((await screen.findByRole("alert")).textContent).toBe("session_expired: sign in again");
	});

	it("publish issues reach the field that has them", async () => {
		const { client } = renderMinimal();
		const input = await title();
		client.publish.mockRejectedValueOnce(
			invalidError([{ code: "required", path: "title", message: "title is required" }]),
		);
		fireEvent.click(screen.getByText("publish"));
		await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
		expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("title is required"))).toBe(true);
	});

	it("a trashed entry is read-only in the field", async () => {
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

	it("useEntryEditorContext outside a provider says so", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useEntryEditorContext())).toThrow("EntryEditorProvider");
		log.mockRestore();
	});

	it("EntryEditorProvider needs the value that useEntryEditor returned", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => render(<EntryEditorProvider editor={{} as never}>x</EntryEditorProvider>)).toThrow("useEntryEditor");
		log.mockRestore();
	});

	it("callbacks may be new functions on every render and the latest one is called", async () => {
		const fake = fakeClient();
		const recovery = fakeRecoveryStore();
		const seen: string[] = [];
		function Editor({ tag }: { tag: string }) {
			const editor = useEntryEditor({
				adminId: "u1",
				target: { mode: "edit", entryId: "entry-1" },
				client: fake.client,
				recoveryStore: recovery.store,
				onSaved: () => seen.push(tag),
			});
			return (
				<button
					type="button"
					onClick={() => {
						editor.setForm({ title: "수정" });
						void editor.save();
					}}
				>
					go
				</button>
			);
		}
		const { rerender } = render(<Editor tag="first" />);
		await waitFor(() => expect(fake.client.get).toHaveBeenCalled());
		rerender(<Editor tag="second" />);
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
		fireEvent.click(screen.getByText("go"));
		await waitFor(() => expect(seen).toEqual(["second"]));
	});
});
