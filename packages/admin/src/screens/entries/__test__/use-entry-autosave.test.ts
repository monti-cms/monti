import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FORM } from "../entry-form";
import { BACKUP_IDLE_MS, useEntryAutosave } from "../use-entry-autosave";

const { saveLocalBackup, deleteLocalBackup, fetchMock } = vi.hoisted(() => ({
	saveLocalBackup: vi.fn(async () => true),
	deleteLocalBackup: vi.fn(async () => {}),
	fetchMock: vi.fn(),
}));
vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	saveLocalBackup,
	deleteLocalBackup,
}));

const entry = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 1,
	working: { metadata: { title: "제목" }, mdx: "" },
} as never;

const setup = () =>
	renderHook(() =>
		useEntryAutosave({
			adminId: "u1",
			collection: "post",
			entry,
			initialForm: { ...EMPTY_FORM, title: "제목" },
			enabled: true,
			onSaved: vi.fn(),
			onConflict: vi.fn(),
		}),
	);

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("browser temporary save", () => {
	it("after input pauses for the set time, keeps only the last state and does not send it to the server", async () => {
		const { result } = setup();
		act(() => result.current.setForm({ title: "가" }));
		await act(async () => vi.advanceTimersByTimeAsync(BACKUP_IDLE_MS - 1000));
		act(() => result.current.setForm({ title: "가나" }));
		// If input continues, count again.
		await act(async () => vi.advanceTimersByTimeAsync(BACKUP_IDLE_MS - 1000));
		expect(saveLocalBackup).not.toHaveBeenCalled();

		await act(async () => vi.advanceTimersByTimeAsync(1000));
		expect(saveLocalBackup).toHaveBeenCalledTimes(1);
		expect(saveLocalBackup).toHaveBeenCalledWith(
			expect.objectContaining({ snapshot: expect.objectContaining({ title: "가나" }) }),
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("the body a save sends", () => {
	const doc = {
		type: "doc",
		version: 1,
		content: [{ type: "paragraph", id: "abcd1234", content: [{ type: "text", text: "본문" }] }],
	};
	const saveWith = async (documentOf: (mdx: string) => unknown) => {
		fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...(entry as object), version: 2 }) });
		const { result } = renderHook(() =>
			useEntryAutosave({
				adminId: "u1",
				collection: "post",
				entry,
				initialForm: { ...EMPTY_FORM, title: "제목" },
				enabled: true,
				onSaved: vi.fn(),
				onConflict: vi.fn(),
				documentOf: documentOf as never,
			}),
		);
		act(() => result.current.setForm({ mdx: "본문\n" }));
		await act(async () => {
			const saving = result.current.flush();
			await vi.runAllTimersAsync();
			await saving;
		});
		return JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
	};

	it("is the editor's document, with its block ids, when the editor made the MDX in the form", async () => {
		const body = await saveWith((mdx) => (mdx === "본문\n" ? doc : undefined));
		expect(body.doc).toEqual(doc);
		expect(body).not.toHaveProperty("mdx");
	});

	it("is the MDX when the form holds text the editor did not make (source mode, a template)", async () => {
		const body = await saveWith(() => undefined);
		expect(body.mdx).toBe("본문\n");
		expect(body).not.toHaveProperty("doc");
	});
});
