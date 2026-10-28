// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readsImport, type ZipReading, zipPhase } from "../zip-phase";

const base: ZipReading = {
	hasFile: true,
	tooLarge: false,
	stateReady: true,
	empty: false,
	restoreSettled: false,
	isBackup: false,
	restored: false,
	importRead: false,
	importFailed: false,
};
const reading = (patch: Partial<ZipReading>): ZipReading => ({ ...base, ...patch });

describe("zipPhase", () => {
	it("is idle until a zip is chosen", () => {
		expect(zipPhase(reading({ hasFile: false }))).toBe("idle");
	});

	it("refuses a file over the limit before reading anything", () => {
		expect(zipPhase(reading({ tooLarge: true }))).toBe("too-large");
		expect(readsImport(reading({ tooLarge: true }))).toBe(false);
	});

	it("reads until it knows whether the site is empty", () => {
		expect(zipPhase(reading({ stateReady: false }))).toBe("reading");
		expect(readsImport(reading({ stateReady: false }))).toBe(false);
	});

	it("on a site with entries only imports, and never asks whether the zip is a backup", () => {
		expect(readsImport(reading({}))).toBe(true);
		expect(zipPhase(reading({}))).toBe("reading");
		expect(zipPhase(reading({ importRead: true }))).toBe("import");
		expect(zipPhase(reading({ importRead: true, isBackup: true }))).toBe("import");
		expect(zipPhase(reading({ importFailed: true }))).toBe("failed");
	});

	it("on an empty site waits for the backup check, then restores a backup", () => {
		const empty = reading({ empty: true });
		expect(zipPhase(empty)).toBe("reading");
		expect(readsImport(empty)).toBe(false);
		const backup = reading({ empty: true, restoreSettled: true, isBackup: true });
		expect(zipPhase(backup)).toBe("restore");
		expect(readsImport(backup)).toBe(false);
	});

	it("on an empty site imports a zip that is not a backup, or that the backup check could not read", () => {
		const other = reading({ empty: true, restoreSettled: true });
		expect(readsImport(other)).toBe(true);
		expect(zipPhase(other)).toBe("reading");
		expect(zipPhase({ ...other, importRead: true })).toBe("import");
		expect(zipPhase({ ...other, importFailed: true })).toBe("failed");
	});

	it("keeps the restore result in its sheet after the site stops being empty", () => {
		const done = reading({ restored: true, empty: false, restoreSettled: true, isBackup: true });
		expect(zipPhase(done)).toBe("restore");
		expect(readsImport(done)).toBe(false);
	});
});
