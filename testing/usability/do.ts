/** One command to the usability driver: `node testing/usability/do.ts move 300 400 --steps 20`. Prints what it answers. */
const [command, ...args] = process.argv.slice(2);
if (!command) {
	console.error("usage: node testing/usability/do.ts <command> [args]");
	process.exit(2);
}
const answer = await fetch("http://127.0.0.1:4600", { method: "POST", body: JSON.stringify({ command, args }) });
const { ok, result, error } = (await answer.json()) as { ok: boolean; result?: unknown; error?: string };
if (!ok) {
	console.error(error);
	process.exit(1);
}
if (result !== undefined) console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));

export {};
