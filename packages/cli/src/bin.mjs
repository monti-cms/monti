#!/usr/bin/env node
import { createJiti } from "jiti";

/**
 * CLI 코드와 사용자의 설정·스키마 파일을 함께 불러오는 하나뿐인 로더. 같은 모듈 캐시를 쓰므로 설정 파일이 import하는
 * `@monti-cms/core`가 CLI가 쓰는 core와 같은 모듈이 된다.
 */
const jiti = createJiti(import.meta.url, { interopDefault: true });

/** 숨김 입력에서 줄을 끝내는 글자(Enter, Ctrl+D). */
const enterKeys = new Set(["\r", "\n", "\u0004"]);

/** 숨김 입력에서 앞 글자를 지우는 글자(Backspace). */
const eraseKeys = new Set(["\u007f", "\b"]);

/** 숨김 입력을 그만두는 글자(Ctrl+C). */
const cancelKey = "\u0003";

function stdout(text) {
	process.stdout.write(text);
}

function stderr(text) {
	process.stderr.write(text);
}

/** 표준 입력을 끝까지 UTF-8 글로 읽는다. */
async function readStdin() {
	process.stdin.setEncoding("utf8");
	let text = "";
	for await (const chunk of process.stdin) text += chunk;
	return text;
}

/** 설정·스키마 파일을 CLI와 같은 jiti로 불러온다. */
function loader(file) {
	return jiti.import(file);
}

/**
 * 터미널인 `stdin`을 raw 모드로 바꿔, 받은 글자를 화면에 보이지 않게 모아 한 줄을 받고 원래 모드로 돌린다. Enter(또는 Ctrl+D)에서
 * 그 줄을 돌려주고, Ctrl+C에서는 오류로 끝난다.
 */
function readHiddenLine(stdin) {
	const wasRaw = stdin.isRaw;
	stdin.setEncoding("utf8");
	stdin.setRawMode(true);
	return new Promise((resolve, reject) => {
		let line = "";
		function finish(settle, value) {
			stdin.off("data", onData);
			stdin.setRawMode(wasRaw);
			stdin.pause();
			settle(value);
		}
		function onData(chunk) {
			for (const key of chunk) {
				if (key === cancelKey) return finish(reject, new Error("입력을 취소했다"));
				if (enterKeys.has(key)) return finish(resolve, line);
				line = eraseKeys.has(key) ? line.slice(0, -1) : line + key;
			}
		}
		stdin.on("data", onData);
		stdin.resume();
	});
}

/** `label`을 `stderr`에 묻고, 화면에 보이지 않게 입력받은 값. */
async function promptSecret(label) {
	stderr(`${label}: `);
	try {
		return await readHiddenLine(process.stdin);
	} finally {
		stderr("\n");
	}
}

const { runCli } = await jiti.import("./index.ts");

process.exitCode = await runCli(process.argv.slice(2), {
	cwd: process.cwd(),
	env: process.env,
	isTTY: Boolean(process.stdin.isTTY),
	stdout,
	stderr,
	readStdin,
	promptSecret,
	loader,
});
