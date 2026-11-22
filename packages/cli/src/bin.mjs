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

/** 숨김 입력을 받는 중에 `stdin`이 끝났음을 알리는 사건: 입력 끝(`end`), 닫힘(`close`), 오류(`error`). */
const endEvents = ["end", "close", "error"];

/** 설정 파일도 `.env`도 쓰지 않는 도움말·버전 옵션. `.env`를 읽지 못해도 이 옵션이 있으면 그대로 실행한다. */
const infoFlags = new Set(["--help", "-h", "--version", "-v"]);

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
 * 그 줄을 돌려주고, Ctrl+C에서나 줄을 끝내기 전에 `stdin`이 끝나면(`endEvents`) 오류로 끝난다. Backspace는 글자 하나를 코드
 * 포인트 단위로 지워 이모지 같은 글자를 반만 남기지 않는다. 어떻게 끝나든 듣던 사건을 모두 떼고 원래 모드로 돌린다.
 */
function readHiddenLine(stdin) {
	const wasRaw = stdin.isRaw;
	stdin.setEncoding("utf8");
	stdin.setRawMode(true);
	return new Promise((resolve, reject) => {
		let line = "";
		function finish(settle, value) {
			stdin.off("data", onData);
			for (const event of endEvents) stdin.off(event, onEnd);
			if (!stdin.destroyed) stdin.setRawMode(wasRaw);
			stdin.pause();
			settle(value);
		}
		function onData(chunk) {
			for (const key of chunk) {
				if (key === cancelKey) return finish(reject, new Error("입력을 취소했다"));
				if (enterKeys.has(key)) return finish(resolve, line);
				line = eraseKeys.has(key) ? [...line].slice(0, -1).join("") : line + key;
			}
		}
		function onEnd(error) {
			finish(reject, error instanceof Error ? error : new Error("줄을 끝내기 전에 입력이 끝났다"));
		}
		stdin.on("data", onData);
		for (const event of endEvents) stdin.on(event, onEnd);
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

/**
 * 작업 디렉터리의 `.env.local`·`.env` 값 가운데 `process.env`에 없는 이름만 채워, 설정 파일도 `process.env`에서 읽게 한다.
 * 파일을 읽지 못하면(폴더이거나 읽을 권한이 없는 등) 한 줄 오류를 쓰고 `false`다. 다만 `argv`가 도움말·버전(`infoFlags`)을
 * 물으면 `.env`가 필요 없으므로 오류 없이 `true`다.
 */
async function fillProcessEnv(argv) {
	const { loadEnv } = await jiti.import("./boot/env.ts");
	try {
		for (const [key, value] of Object.entries(loadEnv(process.cwd(), process.env))) {
			if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
		}
		return true;
	} catch (error) {
		if (argv.some((arg) => infoFlags.has(arg))) return true;
		stderr(`.env 파일을 읽을 수 없다: ${error.message}\n`);
		return false;
	}
}

/** `argv`(명령 이름 뒤의 인자)를 실행하고 종료 코드를 돌려준다. `.env`를 읽지 못했으면 실행하지 않고 `1`이다. */
async function main(argv) {
	if (!(await fillProcessEnv(argv))) return 1;
	const { runCli } = await jiti.import("./index.ts");
	return runCli(argv, {
		cwd: process.cwd(),
		env: process.env,
		isTTY: Boolean(process.stdin.isTTY),
		stdout,
		stderr,
		readStdin,
		promptSecret,
		loader,
	});
}

process.exitCode = await main(process.argv.slice(2));
