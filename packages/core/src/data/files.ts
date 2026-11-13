import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Monti } from "../monti";
import { type RestoreProblem, readBackup, restoreBackup } from "./backup";
import { unzip, type ZipFile, zipStream } from "./zip";

/** Writes the site's backup to a file (`monti backup`): the text files, and with `media` every media file under `media/<key>`. */
export async function writeBackup(
	monti: Monti,
	file: string,
	options: { media: boolean },
): Promise<{ entries: number; files: number }> {
	const backup = await readBackup(monti.db, monti.site.schema(), monti.now());
	const encoder = new TextEncoder();
	let files = 0;
	async function* parts(): AsyncGenerator<ZipFile> {
		for (const [name, text] of Object.entries(backup.files)) yield { name, bytes: encoder.encode(text) };
		if (!options.media || !monti.site.storage) return;
		for (const { key } of backup.media) {
			const found = await monti.site.storage.read(key);
			if (!found) continue;
			files += 1;
			yield { name: `media/${key}`, bytes: found.bytes };
		}
	}
	await pipeline(Readable.from(zipStream(parts())), createWriteStream(file));
	return { entries: backup.manifest.counts.entries, files };
}

/** Restores a backup file into the site's empty database (`monti restore`). */
export async function restoreFrom(monti: Monti, file: string) {
	const zip = unzip(new Uint8Array(await readFile(file)));
	if (!zip) return { problems: [{ problem: "unreadable", file } satisfies RestoreProblem] };
	return restoreBackup(monti.db, monti.site.schema(), monti.site.storage, (name) => zip.read(name));
}

/** A restore's problem as the command line says it. */
export function restoreProblem(problem: RestoreProblem): string {
	const entries = (count: number) => (count === 1 ? "1 entry" : `${count} entries`);
	switch (problem.problem) {
		case "notEmpty":
			return "The database has entries. A backup is restored into an empty one; into a site with entries, import it from a collection's list.";
		case "unreadable":
			return `${problem.file} could not be read as a Monti backup.`;
		case "unknownCollection":
			return `The site has no collection "${problem.collection}" (${entries(problem.entries)}).`;
		case "unknownField":
			return `The collection "${problem.collection}" has no field "${problem.field}" (${entries(problem.entries)} hold a value for it).`;
		case "sameAddress":
			return `${entries(problem.entries)} of "${problem.collection}" (${problem.locale}) share the address "${problem.slug}".`;
	}
}
