import { readFile, writeFile } from "node:fs/promises";

/** `monti.config.ts`의 사이트 이름: 첫 `name` 속성의 큰따옴표 문자열. 이름 안의 `\"` 같은 이스케이프까지 한 문자열로 본다. */
const SITE_NAME = /name: "(?:[^"\\]|\\.)*"/;

/** `monti.config.ts`의 사이트 이름만 바꾸고 파일의 나머지는 그대로 둔다. */
export async function writeConfigName(file: string, name: string): Promise<void> {
	const text = await readFile(file, "utf8");
	await writeFile(
		file,
		text.replace(SITE_NAME, () => `name: ${JSON.stringify(name)}`),
	);
}
