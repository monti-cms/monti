import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readChangeFiles } from "./files";

describe("schema change files", () => {
	it("rejects malformed or misnamed files", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const changes = path.join(root, "monti", "changes");
		await mkdir(changes, { recursive: true });
		await writeFile(path.join(changes, "bad.json"), "{}");
		await expect(readChangeFiles(changes)).rejects.toThrow();
		await writeFile(path.join(changes, "bad.json"), JSON.stringify({ id: "other", steps: [] }));
		await expect(readChangeFiles(changes)).rejects.toThrow("does not match its id");
	});
});
