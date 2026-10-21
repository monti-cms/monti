import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, vi } from "vitest";
import { parseSchemaLiteral } from "../../schema-file/literal";
import { QUESTIONS } from "../init-prompts";
import type { InitHost } from "../init-types";
import { Cancelled, type Prompter, type TaskOutcome } from "../prompt";

/** Shared by the tests of `monti init`: fixture Next apps in temp folders, a host that touches nothing, and a prompter that answers from a script. */

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

export const DEFAULT_NEXT_CONFIG = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
`;

/** The root layout `create-next-app` writes. */
export const CREATE_NEXT_APP_LAYOUT = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

/** The files `create-next-app` writes (App Router, TypeScript, Tailwind), without an install. */
export const CREATE_NEXT_APP: Record<string, string> = {
	"package.json": JSON.stringify(
		{
			name: "my-blog",
			private: true,
			scripts: { dev: "next dev", build: "next build" },
			dependencies: { next: "16.3.8", react: "19.2.3", "react-dom": "19.2.3" },
			devDependencies: { typescript: "^5", tailwindcss: "^4", "@types/node": "^20" },
		},
		null,
		2,
	),
	"tsconfig.json": JSON.stringify({
		compilerOptions: { strict: true, paths: { "@/*": ["./*"] } },
	}),
	"app/layout.tsx": CREATE_NEXT_APP_LAYOUT,
	"app/page.tsx": "export default function Home() { return null; }\n",
	"app/globals.css": '@import "tailwindcss";\n',
	"next.config.ts": DEFAULT_NEXT_CONFIG,
	"pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
	".gitignore": "node_modules\n.next\n.env*\n",
};

/** A temp project folder with the given files (default: a fresh `create-next-app`). Removed after the test. */
export function fixtureApp(
	files: Record<string, string | null> = {},
	base: Record<string, string> = CREATE_NEXT_APP,
): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-init-"));
	dirs.push(dir);
	for (const [file, content] of Object.entries({ ...base, ...files })) {
		if (content === null) continue;
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
}

/** A project that keeps its code in `src/`. */
export const SRC_APP: Record<string, string | null> = {
	"app/layout.tsx": null,
	"app/page.tsx": null,
	"app/globals.css": null,
	"src/app/layout.tsx": CREATE_NEXT_APP_LAYOUT,
	"src/app/page.tsx": "export default function Home() { return null; }\n",
	"src/app/globals.css": '@import "tailwindcss";\n',
	"tsconfig.json": JSON.stringify({
		compilerOptions: { strict: true, paths: { "@/*": ["./src/*"] } },
	}),
};

export const POST_MDX = (title: string) =>
	`---\ntitle: ${title}\ndate: 2024-05-01\ndescription: About ${title}\ntags:\n  - web\ncover: /images/${title}.png\ndraft: false\nauthor: Me\n---\n\nBody of ${title}.\n`;

export const read = (dir: string, file: string) => readFileSync(path.join(dir, file), "utf8");

/** The data of the schema file `monti init` wrote (a pure literal, read without running it). */
// biome-ignore lint/suspicious/noExplicitAny: a test reads any part of the data
export const schemaOf = (dir: string, file = "monti.schema.ts"): Record<string, any> => {
	const literal = parseSchemaLiteral(read(dir, file));
	if (!literal.ok) throw new Error(`${file} is not a pure literal: ${literal.message}`);
	return literal.value;
};

/** Every file under `dir` (relative, `/`-separated, sorted). */
export function listFiles(dir: string, prefix = ""): string[] {
	return readdirSync(path.join(dir, prefix))
		.flatMap((name) => {
			const relative = prefix ? `${prefix}/${name}` : name;
			return statSync(path.join(dir, relative)).isDirectory() ? listFiles(dir, relative) : [relative];
		})
		.sort();
}

export interface FakeHost extends InitHost {
	install: ReturnType<typeof vi.fn<InitHost["install"]>>;
	setupDatabase: ReturnType<typeof vi.fn<InitHost["setupDatabase"]>>;
	runDoctor: ReturnType<typeof vi.fn<InitHost["runDoctor"]>>;
}

/** A host that installs nothing, and records the calls. */
export function fakeHost(overrides: Partial<InitHost> = {}): FakeHost {
	return {
		install: vi.fn<InitHost["install"]>(),
		// a fixed computer time zone, so a test does not depend on the machine it runs on
		systemTimeZone: () => "UTC",
		// no database URL from the machine the test runs on
		environment: () => ({}),
		setupDatabase: vi.fn<InitHost["setupDatabase"]>(async () => undefined),
		runDoctor: vi.fn<InitHost["runDoctor"]>(async (cwd) => ({
			ok: true,
			cwd,
			summary: { ok: 3, warn: 0, fail: 0, skip: 0 },
			checks: [],
		})),
		...overrides,
	} as unknown as FakeHost;
}

/** The order the questions are asked in, as the messages of the prompts. */
export interface ScriptedPrompter extends Prompter {
	readonly asked: string[];
	readonly notes: { title?: string; body: string }[];
	/** How each progress step ended, in order. */
	readonly steps: TaskOutcome[];
}

/**
 * A prompter that answers from a script: for each question, the first entry whose key is contained in the message is used (an array answer is used once,
 * then the next call to the same key is an error). A `"cancel"` answer cancels like Ctrl+C.
 */
export function scriptedPrompter(
	scriptGiven: Record<string, string | boolean | string[] | "cancel">,
): ScriptedPrompter {
	// The two questions that came with the recommended setup are answered the way the full sequence ran before them, unless a test says otherwise.
	const script: Record<string, string | boolean | string[] | "cancel"> = {
		[QUESTIONS.setup]: "custom",
		[QUESTIONS.setupNow]: true,
		...scriptGiven,
	};
	const asked: string[] = [];
	const notes: { title?: string; body: string }[] = [];
	const steps: TaskOutcome[] = [];
	const answer = (message: string): unknown => {
		asked.push(message);
		const key = Object.keys(script).find((candidate) => message.includes(candidate));
		if (key === undefined) throw new Error(`no scripted answer for "${message}"`);
		const value = script[key];
		if (value === "cancel") throw new Cancelled();
		return value;
	};
	return {
		asked,
		notes,
		steps,
		intro: () => undefined,
		outro: () => undefined,
		note: (body, title) => void notes.push({ body, title }),
		select: async (question) => answer(question.message) as never,
		multiselect: async (question) => answer(question.message) as never,
		text: async (question) => {
			const value = answer(question.message) as string;
			const problem = question.validate?.(value);
			if (problem) throw new Error(`scripted answer "${value}" to "${question.message}" is invalid: ${problem}`);
			return value;
		},
		password: async (question) => answer(question.message) as string,
		confirm: async (question) => answer(question.message) as never,
		task: async (title, work) => {
			asked.push(`task: ${title}`);
			const outcome = await work();
			steps.push(outcome);
			return outcome;
		},
	};
}
