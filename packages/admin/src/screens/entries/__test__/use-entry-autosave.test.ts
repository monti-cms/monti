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

describe("브라우저 임시 저장", () => {
	it("입력이 멈추고 정해 둔 시간이 지나야 마지막 상태 하나만 남기고, 서버에는 보내지 않는다", async () => {
		const { result } = setup();
		act(() => result.current.setForm({ title: "가" }));
		await act(async () => vi.advanceTimersByTimeAsync(BACKUP_IDLE_MS - 1000));
		act(() => result.current.setForm({ title: "가나" }));
		// 입력이 이어지면 다시 센다.
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
