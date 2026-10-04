import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter } from "../../frontmatter";

/** 회귀 테스트용 실제 글 본문. 예전 파일 기반 글에서 문법이 다양한 글만 골라 두었다. */
// 테스트 실행기는 `__dirname`을 주고, ESM으로 빌드한 패키지(`dist`)는 `import.meta.url`로 찾는다.
export const SAMPLES_DIR =
	typeof __dirname === "string" ? path.join(__dirname, "samples") : fileURLToPath(new URL("samples", import.meta.url));

export const readSample = (name: string): string => readFileSync(path.join(SAMPLES_DIR, name), "utf8");

/** 모든 예시 글. `mdx`는 머리말을 뗀 본문이다(DB에 저장되는 모양). */
export const readSamples = (): { name: string; mdx: string }[] =>
	readdirSync(SAMPLES_DIR)
		.filter((file) => file.endsWith(".mdx"))
		.sort()
		.map((name) => ({ name, mdx: splitFrontmatter(readSample(name)).body }));
