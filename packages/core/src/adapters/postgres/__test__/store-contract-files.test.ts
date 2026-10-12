import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORE_CONTRACT_SUITES } from "../../../core/store/__test__/contract/store-contract";

/** The store contract runs one test file per suite for speed. This keeps a suite from being added to the contract without a file that runs it. */
describe("postgres store contract files", () => {
	it("has a test file for every suite of the contract", () => {
		const names = Object.keys(STORE_CONTRACT_SUITES);
		const contractDir = path.resolve(__dirname, "../../../core/store/__test__/contract");
		const onDisk = fs
			.readdirSync(contractDir)
			.filter((file) => file.endsWith(".contract.ts"))
			.map((file) => file.replace(/\.contract\.ts$/, ""));
		expect(names.sort()).toEqual(onDisk.sort());
		for (const name of names) {
			const file = path.join(__dirname, `store-contract.${name}.test.ts`);
			expect(fs.existsSync(file), `${path.basename(file)} is missing`).toBe(true);
			expect(fs.readFileSync(file, "utf8")).toContain(`runStoreContractSuite("${name}"`);
		}
	});
});
