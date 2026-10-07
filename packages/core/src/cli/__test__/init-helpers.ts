import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, vi } from "vitest";
import type { InitHost } from "../init";
import { InitCancelled, type Prompter } from "../init-prompts";

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
		compilerOptions: { strict: true, resolveJsonModule: true, paths: { "@/*": ["./*"] } },
	}),
	"app/layout.tsx": "export default function RootLayout() { return null; }\n",
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
	"src/app/layout.tsx": "export default function RootLayout() { return null; }\n",
	"src/app/page.tsx": "export default function Home() { return null; }\n",
	"src/app/globals.css": '@import "tailwindcss";\n',
	"tsconfig.json": JSON.stringify({
		compilerOptions: { strict: true, resolveJsonModule: true, paths: { "@/*": ["./src/*"] } },
	}),
};

export const POST_MDX = (title: string) =>
	`---\ntitle: ${title}\ndate: 2024-05-01\ndescription: About ${title}\ntags:\n  - web\ncover: /images/${title}.png\ndraft: false\nauthor: Me\n---\n\nBody of ${title}.\n`;

export const read = (dir: string, file: string) => readFileSync(path.join(dir, file), "utf8");

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
	run: ReturnType<typeof vi.fn<InitHost["run"]>>;
	install: ReturnType<typeof vi.fn<InitHost["install"]>>;
	migrate: ReturnType<typeof vi.fn<InitHost["migrate"]>>;
	databaseReachable: ReturnType<typeof vi.fn<InitHost["databaseReachable"]>>;
}

/** A host that installs, starts and migrates nothing, and records the calls. */
export function fakeHost(overrides: Partial<InitHost> = {}): FakeHost {
	return {
		run: vi.fn<InitHost["run"]>(() => true),
		dockerAvailable: () => true,
		freePort: async (start) => start,
		databaseReachable: vi.fn<InitHost["databaseReachable"]>(async () => true),
		generateSecret: () => "generated-secret",
		install: vi.fn<InitHost["install"]>(),
		migrate: vi.fn<InitHost["migrate"]>(async () => true),
		...overrides,
	} as FakeHost;
}

/** The order the questions are asked in, as the messages of the prompts. */
export interface ScriptedPrompter extends Prompter {
	readonly asked: string[];
	readonly notes: { title?: string; body: string }[];
}

/**
 * A prompter that answers from a script: for each question, the first entry whose key is contained in the message is used (an array answer is used once,
 * then the next call to the same key is an error). A `"cancel"` answer cancels like Ctrl+C.
 */
export function scriptedPrompter(script: Record<string, string | boolean | string[] | "cancel">): ScriptedPrompter {
	const asked: string[] = [];
	const notes: { title?: string; body: string }[] = [];
	const answer = (message: string): unknown => {
		asked.push(message);
		const key = Object.keys(script).find((candidate) => message.includes(candidate));
		if (key === undefined) throw new Error(`no scripted answer for "${message}"`);
		const value = script[key];
		if (value === "cancel") throw new InitCancelled();
		return value;
	};
	return {
		asked,
		notes,
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
		confirm: async (question) => answer(question.message) as never,
	};
}
