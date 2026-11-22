import { mkdir, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { MontiConfig, Schema } from "@monti-cms/core";
import type { CliIo } from "../commands/types";

/** 테스트가 CLI에 넘기는 입출력과, CLI가 쓴 출력·숨김 입력 요청을 보는 함수. */
interface TestIo {
	io: CliIo;
	/** `stdout`에 쓴 글 전체. */
	stdout: () => string;
	/** `stderr`에 쓴 글 전체. */
	stderr: () => string;
	/** `promptSecret`이 받은 이름, 부른 순서대로. */
	prompts: string[];
}

/** `testIo`에 넘기는 것. 없는 값은 비대화형 터미널, 빈 환경 변수다. */
interface IoOptions {
	env?: Record<string, string | undefined>;
	isTTY?: boolean;
	/** `promptSecret`이 돌려줄 값. */
	secret?: string;
}

/** 프로젝트 파일 이름(`monti.config.ts` 등)마다 그 TypeScript 글. */
type ProjectFiles = Record<string, string>;

/** 테스트 프로젝트의 사이트 설정. */
export const siteConfig: MontiConfig = { name: "테스트 사이트" };

/** 테스트 프로젝트의 스키마: `posts` 컬렉션 하나. */
export const postsSchema: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" } } } },
};

/** 이 저장소의 core 패키지 폴더. */
const coreDir = path.resolve(createRequire(import.meta.url).resolve("@monti-cms/core"), "../..");

/** `value`를 `default`로 내보내는 TypeScript 모듈 글. */
export function defaultModule(value: unknown): string {
	return `const value: unknown = ${JSON.stringify(value)};\nexport default value;\n`;
}

/**
 * 설정·스키마 파일을 vitest의 모듈 그래프로 불러온다. 설정 파일이 import하는 `@monti-cms/core`가 CLI 코드와 같은 모듈이 되어,
 * `bin.mjs`의 단일 jiti 로더처럼 core를 한 번만 불러온다.
 */
async function importFile(file: string): Promise<Record<string, unknown>> {
	return import(file);
}

/** `cwd`에서 실행하는 CLI 입출력. 출력은 모아 두고, 숨김 입력은 받은 이름을 적어 둔 뒤 `options.secret`을 돌려준다. */
export function testIo(cwd: string, options: IoOptions = {}): TestIo {
	let stdout = "";
	let stderr = "";
	const prompts: string[] = [];
	const io: CliIo = {
		cwd,
		env: options.env ?? {},
		isTTY: options.isTTY ?? false,
		stdout: (text) => {
			stdout += text;
		},
		stderr: (text) => {
			stderr += text;
		},
		readStdin: async () => "",
		promptSecret: async (label) => {
			prompts.push(label);
			return options.secret ?? "";
		},
		loader: importFile,
	};
	return { io, stdout: () => stdout, stderr: () => stderr, prompts };
}

/**
 * `cwd`에 프로젝트 파일을 쓴다. `files`에 없는 설정·스키마 파일은 `siteConfig`와 `postsSchema`로 쓴다. 설치한 프로젝트처럼
 * 설정 파일이 `@monti-cms/core`와 `zod`를 import할 수 있게 `node_modules`에 이 저장소의 패키지를 잇는 링크도 만든다.
 */
export async function writeProject(cwd: string, files: ProjectFiles = {}): Promise<void> {
	const all: ProjectFiles = {
		"monti.config.ts": defaultModule(siteConfig),
		"monti.schema.ts": defaultModule(postsSchema),
		...files,
	};
	for (const [name, text] of Object.entries(all)) await writeFile(path.join(cwd, name), text);
	const modules = path.join(cwd, "node_modules");
	await mkdir(path.join(modules, "@monti-cms"), { recursive: true });
	await symlink(coreDir, path.join(modules, "@monti-cms", "core"), "dir");
	await symlink(path.join(coreDir, "node_modules", "zod"), path.join(modules, "zod"), "dir");
}

/** `cwd`의 프로젝트 파일 `name`을 CLI와 같은 로더로 불러온 모듈. CLI가 불러온 것과 같은 모듈이다. */
export async function projectModule(cwd: string, name: string): Promise<Record<string, unknown>> {
	return importFile(path.join(cwd, name));
}

/** 출력 글을 JSON으로 읽은 값. JSON이 아니면(빈 출력 포함) 글 그대로를 돌려줘, 기대한 값과 다르면 `expect`에서 실패한다. */
export function parseOutput(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
