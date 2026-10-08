import { describe, expect, it } from "vitest";
import { runCli } from "../index";

const help = async (...argv: string[]) => {
	const out: string[] = [];
	const code = await runCli(argv, {
		cwd: process.cwd(),
		log: (line) => out.push(line),
		error: (line) => out.push(line),
	});
	return { code, text: out.join("\n") };
};

const COMMANDS = [
	"init",
	"migrate",
	"events:retry",
	"doctor",
	"schema:types",
	"schema:extract",
	"schema:diff",
	"schema:apply",
];

/** The names of the commands whose section is in a help text (a section starts with two spaces and the name). */
const sectionsIn = (text: string) => COMMANDS.filter((name) => new RegExp(`^ {2}${name}\\s`, "m").test(text));

describe("monti help", () => {
	it("`monti --help` lists every command and says to install the package first", async () => {
		const { code, text } = await help("--help");
		expect(code).toBe(0);
		expect(sectionsIn(text)).toEqual(COMMANDS);
		expect(text).toContain("Install first");
		expect(text).toContain("pnpm exec monti init");
		expect(text).toContain('a different package called "monti"');
	});

	it.each(COMMANDS)("`monti %s --help` prints that command's options and no other command", async (command) => {
		const { code, text } = await help(command, "--help");
		expect(code).toBe(0);
		expect(sectionsIn(text)).toEqual([command]);
		expect(text).toContain("--");
	});

	it("`monti init --help` names the flags that were added", async () => {
		const { text } = await help("init", "--help");
		expect(text).not.toContain("--database-schema");
		expect(text).not.toContain("--admin-github-id");
		expect(text).toContain("--blocks <list>");
		expect(text).toMatch(/mermaid.*opt-in|opt-in.*mermaid/s);
		expect(text).not.toContain("--registry");
	});

	it("-h is the same as --help, and an unknown command still prints the whole help", async () => {
		expect((await help("init", "-h")).text).toBe((await help("init", "--help")).text);
		const unknown = await help("nope");
		expect(unknown.code).toBe(1);
		expect(unknown.text).toContain("Unknown command: nope");
		expect(sectionsIn(unknown.text)).toEqual(COMMANDS);
	});
});
