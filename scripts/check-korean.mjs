#!/usr/bin/env node
/**
 * 실행 코드의 한글 문자열 검사(M15-7). 패키지 실행 코드(`packages/*\/src`)의 한국어 문구는 문구 사전 파일
 * (`messages.ts`·`*.messages.ts`)에만 둔다. 주석·테스트(`__test__`·`*.test.*`)·테스트 도우미(`src/test`)는 보지 않는다.
 *
 *   node scripts/check-korean.mjs            # 남은 곳을 보이고 있으면 실패
 *   node scripts/check-korean.mjs packages/admin/src/screens/media   # 일부만
 *
 * 한국어 사용자를 위한 정규식·글자 판별처럼 문구가 아닌 한글은 그 줄 끝에 `// cms-allow-korean: 이유`를 단다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);
const roots = targets.length
	? targets.map((target) => path.resolve(target))
	: readdirSync(path.join(root, "packages"))
			.map((name) => path.join(root, "packages", name, "src"))
			.filter((dir) => {
				try {
					return statSync(dir).isDirectory();
				} catch {
					return false;
				}
			});

const SKIP_DIRS = new Set(["__test__", "node_modules", "dist", "test"]);
const isMessages = (file) => /(^|[./])messages\.tsx?$/.test(path.basename(file));
const isTest = (file) => /\.test\.tsx?$/.test(file);

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(name)) walk(full);
		} else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !isTest(name) && !isMessages(full)) {
			files.push(full);
		}
	}
};
for (const dir of roots) {
	if (statSync(dir).isDirectory()) walk(dir);
	else files.push(dir);
}

/** 주석을 지운다(글자 안의 `//`는 남긴다). 줄 번호를 지키려고 줄바꿈은 남긴다. */
function stripComments(source) {
	let out = "";
	let i = 0;
	let quote = null;
	while (i < source.length) {
		const char = source[i];
		const next = source[i + 1];
		if (quote) {
			out += char;
			if (char === "\\") {
				out += next ?? "";
				i += 2;
				continue;
			}
			if (char === quote) quote = null;
			i += 1;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			out += char;
			i += 1;
			continue;
		}
		// 정규식 리터럴 안의 따옴표·백틱·`//`가 글자·주석 판별을 어긋나게 하지 않도록 통째로 건너뛴다.
		if (
			char === "/" &&
			next !== "/" &&
			next !== "*" &&
			/(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|case|void|throw))\s*$/.test(out)
		) {
			let j = i + 1;
			let inClass = false;
			while (j < source.length && source[j] !== "\n") {
				if (source[j] === "\\") j += 1;
				else if (source[j] === "[") inClass = true;
				else if (source[j] === "]") inClass = false;
				else if (source[j] === "/" && !inClass) break;
				j += 1;
			}
			if (source[j] === "/") {
				out += source.slice(i, j + 1);
				i = j + 1;
				continue;
			}
		}
		if (char === "/" && next === "/") {
			const end = source.indexOf("\n", i);
			const line = source.slice(i, end === -1 ? source.length : end);
			// 허용 표시는 남겨 둔다(그 줄을 건너뛴다).
			out += line.includes("cms-allow-korean") ? "/*allow*/" : "";
			i = end === -1 ? source.length : end;
			continue;
		}
		if (char === "/" && next === "*") {
			const end = source.indexOf("*/", i + 2);
			const block = source.slice(i, end === -1 ? source.length : end + 2);
			out += block.replace(/[^\n]/g, "");
			i = end === -1 ? source.length : end + 2;
			continue;
		}
		out += char;
		i += 1;
	}
	return out;
}

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const found = [];
for (const file of files) {
	const lines = stripComments(readFileSync(file, "utf8")).split("\n");
	lines.forEach((line, index) => {
		if (HANGUL.test(line) && !line.includes("/*allow*/"))
			found.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
	});
}

if (found.length > 0) {
	console.error(`실행 코드에 한국어가 ${found.length}줄 남았습니다. 문구 사전(messages.ts)으로 옮기세요.\n`);
	console.error(found.join("\n"));
	process.exit(1);
}
console.log(`check-korean: ok (${files.length} files)`);
