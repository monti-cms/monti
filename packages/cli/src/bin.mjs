#!/usr/bin/env node
import { createJiti } from "jiti";

function stdout(text) {
	process.stdout.write(text);
}

function stderr(text) {
	process.stderr.write(text);
}

async function readStdin() {
	return "";
}

async function promptSecret() {
	return "";
}

const jiti = createJiti(import.meta.url, { interopDefault: true });
const { runCli } = await jiti.import("./index.ts");

process.exitCode = await runCli(process.argv.slice(2), {
	cwd: process.cwd(),
	env: process.env,
	isTTY: Boolean(process.stdin.isTTY),
	stdout,
	stderr,
	readStdin,
	promptSecret,
});
