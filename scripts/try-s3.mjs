#!/usr/bin/env node
/**
 * Tries the S3 storage (`@monti-cms/storage-s3`) against a real bucket: what the tests can only try on a stand-in.
 *
 *   S3_BUCKET=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… S3_PUBLIC_URL=… S3_ENDPOINT=… node scripts/try-s3.mjs
 *
 * Its settings are the storage's own, from the environment (`S3_REGION`, `S3_FORCE_PATH_STYLE` too), and `TRY_S3_ORIGIN`: an address the
 * bucket's CORS is expected to let `PUT` (a site's address). Nothing of them is kept in the repo, and nothing secret is printed: no key, no
 * signed address. Every object it makes it removes.
 *
 * Each line says what was tried, what the bucket did, and whether that is what Monti counts on. It ends with 1 when something is not.
 *   - the storage contract: put, stat, read, the first bytes, remove; a key that is not there; the first bytes of a file with none
 *   - a signed address: the file goes up; a body one byte longer or shorter, another type, and a missing disposition are refused
 *   - a second PUT to a used address (it is taken, which is why the seal copies), and the copy made inside the bucket, which it does not touch
 *   - a PUT after the address has run out
 *   - the public address serves the file, with its type, cache header and disposition
 *   - the bucket's CORS, as `monti doctor --origin` asks it: for `TRY_S3_ORIGIN`, and for an address nobody allowed
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The packages are TypeScript in the repo: loaded as the `monti` command loads them.
const { createJiti } = await import(
	pathToFileURL(createRequire(path.join(root, "packages", "core", "package.json")).resolve("jiti")).href
);
const jiti = createJiti(import.meta.url);
const { s3Storage } = await jiti.import(path.join(root, "packages", "storage-s3", "src", "index.ts"));
const { storageCors } = await jiti.import(path.join(root, "packages", "core", "src", "cli", "main.ts"));

/** What must never be printed, wherever it turns up (an error's text may quote a request). */
const SECRETS = [process.env.S3_SECRET_ACCESS_KEY, process.env.S3_ACCESS_KEY_ID].filter((value) => value);
const clean = (text) =>
	SECRETS.reduce((cleaned, secret) => cleaned.split(secret).join("***"), String(text)).replace(
		/X-Amz-(Signature|Credential)=[^&\s]+/g,
		"X-Amz-$1=***",
	);
let failed = 0;
function say(what, did, expected) {
	if (!expected) failed += 1;
	console.log(clean(`${expected ? "ok  " : "FAIL"}  ${what}: ${did}`));
}
const firstLine = (error) => `${error?.name ?? "Error"}: ${String(error?.message ?? error).split("\n")[0]}`;
/** Runs one trial; a throw is a failure that is said, and the rest goes on. */
async function trial(what, run) {
	try {
		await run();
	} catch (error) {
		say(what, `it threw (${firstLine(error)})`, false);
	}
}

const id = () => crypto.randomUUID();
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const OTHER = PNG.map((byte, at) => (at > 7 ? 9 : byte));
const PDF = new TextEncoder().encode("%PDF-1.7 a trial of Monti's S3 storage");
const same = (a, b) => a !== null && a !== undefined && a.length === b.length && a.every((byte, at) => byte === b[at]);

const storage = s3Storage();
const made = new Set();
const key = (extension) => {
	const name = `${id()}.${extension}`;
	made.add(name);
	return name;
};
const put = (ticket, body, headers = ticket.headers) =>
	fetch(ticket.url, { method: "PUT", headers, body: body.slice().buffer }).then((answer) => answer.status);

try {
	// Before anything is tried: a missing setting is said by its name.
	storage.url(`${id()}.png`);
} catch (error) {
	console.error(clean(firstLine(error)));
	process.exit(1);
}

await trial("the contract", async () => {
	const name = key("png");
	say(
		"a key that is not there",
		`stat ${JSON.stringify(await storage.stat(name))}`,
		(await storage.stat(name)) === null,
	);
	await storage.put(name, PNG, { mime: "image/png" });
	const stat = await storage.stat(name);
	say("put, then stat", JSON.stringify(stat), stat?.size === PNG.length && stat?.mime === "image/png");
	const read = await storage.read(name);
	say("read", `${read?.bytes.length} bytes, ${read?.mime}`, same(read?.bytes, PNG) && read?.mime === "image/png");
	const start = await storage.readStart(name, 4);
	say("the first 4 bytes", `${start?.length} bytes`, same(start, PNG.subarray(0, 4)));
	await storage.remove(name);
	say("remove", `stat ${JSON.stringify(await storage.stat(name))}`, (await storage.stat(name)) === null);
	await storage.remove(name);
	say("remove what is not there", "no error", true);
});

await trial("a file with no bytes", async () => {
	const name = key("txt");
	await storage.put(name, new Uint8Array(), { mime: "text/plain" });
	const start = await storage.readStart(name, 4096);
	say("the first bytes of a file with none (a ranged GET)", `${start?.length} bytes`, start?.length === 0);
});

await trial("a signed address", async () => {
	const name = key("png");
	const ticket = await storage.ticket(name, { mime: "image/png", size: PNG.length });
	const names = [...new URL(ticket.url).searchParams.keys()];
	say(
		"the address's parameters",
		names.filter((each) => !/Signature|Credential/.test(each)).join(", "),
		!names.some((each) => /checksum/i.test(each)),
	);
	let status = await put(ticket, new Uint8Array([...PNG, 0]));
	say("a body one byte longer than signed", `HTTP ${status}`, status === 403);
	status = await put(ticket, PNG.subarray(0, PNG.length - 1));
	say("a body one byte shorter than signed", `HTTP ${status}`, status === 403);
	status = await put(ticket, PNG, { ...ticket.headers, "content-type": "text/html" });
	say("another Content-Type", `HTTP ${status}`, status === 403);
	say(
		"nothing was stored by those",
		`stat ${JSON.stringify(await storage.stat(name))}`,
		(await storage.stat(name)) === null,
	);
	status = await put(ticket, PNG);
	say("the file as signed", `HTTP ${status}`, status === 200);
	const stat = await storage.stat(name);
	say("what the bucket holds", JSON.stringify(stat), stat?.size === PNG.length && stat?.mime === "image/png");

	const copy = key("png");
	await storage.copy(name, copy);
	const copied = await storage.stat(copy);
	say(
		"a copy made inside the bucket",
		JSON.stringify(copied),
		copied?.size === PNG.length && copied?.mime === "image/png",
	);
	status = await put(ticket, OTHER);
	// Taken or refused, Monti is safe: it uses the copy. Which one it is says whether the copy is what protects the file here.
	say(
		"a second PUT to the used address",
		`HTTP ${status} (${status === 200 ? "taken: the seal's copy is what keeps a checked file from changing" : "refused by this storage"})`,
		status === 200 || status === 403 || status === 412,
	);
	say("the copy after it", "the first bytes", same((await storage.read(copy))?.bytes, PNG));

	const shown = await fetch(storage.url(copy));
	say(
		"the public address",
		`HTTP ${shown.status}, ${shown.headers.get("content-type")}, cache-control ${shown.headers.get("cache-control")}`,
		shown.status === 200 &&
			shown.headers.get("content-type") === "image/png" &&
			(shown.headers.get("cache-control") ?? "").includes("immutable"),
	);
});

await trial("a file that is not a picture", async () => {
	const name = key("pdf");
	const ticket = await storage.ticket(name, { mime: "application/pdf", size: PDF.length });
	const { "content-disposition": _left, ...without } = ticket.headers;
	let status = await put(ticket, PDF, without);
	say("without the disposition it was signed with", `HTTP ${status}`, status === 403);
	status = await put(ticket, PDF);
	say("as signed", `HTTP ${status}`, status === 200);
	const shown = await fetch(storage.url(name));
	say(
		"at the public address it is saved, not opened",
		`HTTP ${shown.status}, content-disposition ${shown.headers.get("content-disposition")}`,
		shown.status === 200 && shown.headers.get("content-disposition") === "attachment",
	);
});

await trial("an address that has run out", async () => {
	const brief = s3Storage({ ticketSeconds: 2 });
	const name = key("png");
	const ticket = await brief.ticket(name, { mime: "image/png", size: PNG.length });
	await new Promise((resolve) => setTimeout(resolve, 5000));
	const status = await put(ticket, PNG);
	say("a PUT three seconds after it ran out", `HTTP ${status}`, status === 403);
	say("nothing was stored", `stat ${JSON.stringify(await storage.stat(name))}`, (await storage.stat(name)) === null);
});

await trial("the bucket's CORS", async () => {
	const origin = process.env.TRY_S3_ORIGIN?.replace(/\/+$/, "");
	if (!origin) console.log("skip  the bucket's CORS for the site's address: set TRY_S3_ORIGIN to try it");
	else {
		const allowed = await storageCors(storage, { origin });
		say(`an upload from ${origin}`, `${allowed.status}: ${allowed.message}`, allowed.status === "ok");
	}
	const stranger = await storageCors(storage, { origin: "https://nobody-allowed-this.invalid" });
	// A bucket open to every address (a `*` rule, or a storage whose CORS is not the bucket's own) is said, not failed.
	console.log(
		clean(
			stranger.status === "fail"
				? `ok    an upload from an address nobody allowed: refused, and the setting to paste is printed:\n${stranger.fix}`
				: "note  an upload from an address nobody allowed is taken: this bucket's CORS lets every address in",
		),
	);
});

for (const name of made) await storage.remove(name).catch(() => {});
console.log(failed === 0 ? "\nEverything Monti counts on held." : `\n${failed} not as Monti counts on.`);
process.exit(failed === 0 ? 0 : 1);
