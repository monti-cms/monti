import { describe, expect, it } from "vitest";
import { addEnvToGitignore, addResolveJsonModule } from "../init-edits";

describe("addResolveJsonModule", () => {
	it("inserts the option at the top of compilerOptions with the file's indentation", () => {
		expect(addResolveJsonModule('{\n\t"compilerOptions": {\n\t\t"strict": true\n\t}\n}\n')).toBe(
			'{\n\t"compilerOptions": {\n\t\t"resolveJsonModule": true,\n\t\t"strict": true\n\t}\n}\n',
		);
	});

	it("handles one-line and empty compilerOptions, and trailing commas", () => {
		expect(addResolveJsonModule('{ "compilerOptions": { "strict": true } }')).toBe(
			'{ "compilerOptions": { "resolveJsonModule": true, "strict": true } }',
		);
		expect(addResolveJsonModule('{ "compilerOptions": {} }')).toBe(
			'{ "compilerOptions": { "resolveJsonModule": true} }',
		);
		expect(addResolveJsonModule('{\n  "compilerOptions": {\n    "strict": true,\n  },\n}\n')).toContain(
			'"resolveJsonModule": true,',
		);
	});

	it("flips an explicit false", () => {
		expect(addResolveJsonModule('{ "compilerOptions": { "resolveJsonModule": false } }')).toBe(
			'{ "compilerOptions": { "resolveJsonModule": true } }',
		);
	});

	it("keeps comments", () => {
		const out = addResolveJsonModule('{\n  /* a */\n  "compilerOptions": {\n    // b\n    "strict": true\n  }\n}\n');
		expect(out).toContain("/* a */");
		expect(out).toContain("// b");
	});

	it("gives up on extends, a missing compilerOptions and unreadable files", () => {
		expect(addResolveJsonModule('{ "extends": "x", "compilerOptions": {} }')).toBeUndefined();
		expect(addResolveJsonModule("{}")).toBeUndefined();
		expect(addResolveJsonModule("not json")).toBeUndefined();
	});
});

describe("addEnvToGitignore", () => {
	it("appends only the missing lines and keeps the rest", () => {
		expect(addEnvToGitignore("node_modules\n")).toBe(
			"node_modules\n\n# Local env files (monti init)\n.env.local\n.env*.local\n",
		);
		expect(addEnvToGitignore(".env.local\n")).toBe(".env.local\n\n# Local env files (monti init)\n.env*.local\n");
		expect(addEnvToGitignore(".env.local\n.env*.local\n")).toBe(".env.local\n.env*.local\n");
	});

	it("builds a file from nothing", () => {
		expect(addEnvToGitignore(undefined)).toBe("# Local env files (monti init)\n.env.local\n.env*.local\n");
	});
});
