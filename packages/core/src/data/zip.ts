/**
 * A zip file written and read with what the server and the browser both have (doc 14, the backup file): `CompressionStream` for deflate, no
 * library. It writes what `unzip` and every unzip tool reads: files stored or deflated, names in UTF-8, no encryption, no zip64 (a file and
 * the archive stay under 4 GB, and under 65,535 files).
 */

export type ZipFile = { name: string; bytes: Uint8Array };

const TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let index = 0; index < bytes.length; index++)
		crc = (TABLE[(crc ^ (bytes[index] as number)) & 0xff] as number) ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Bytes through a stream that packs or unpacks them. With `most`, reading stops with an error once more than that has come out: a packed
 * file says how large it is, and one that unpacks to more is not what it says (a file made to fill the memory).
 */
async function through(
	bytes: Uint8Array,
	stream: CompressionStream | DecompressionStream,
	most?: number,
): Promise<Uint8Array> {
	const writer = stream.writable.getWriter();
	// A broken stream fails the read below, which is where it is caught: the write's own failure must not go unheard beside it.
	void writer
		.write(bytes as Uint8Array<ArrayBuffer>)
		.then(() => writer.close())
		.catch(() => {});
	const reader = stream.readable.getReader();
	const parts: Uint8Array[] = [];
	let length = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		length += value.length;
		if (most !== undefined && length > most) {
			await reader.cancel().catch(() => {});
			throw new Error("The file unpacks to more than it says.");
		}
		parts.push(value);
	}
	const whole = new Uint8Array(length);
	let at = 0;
	for (const part of parts) {
		whole.set(part, at);
		at += part.length;
	}
	return whole;
}

/** What the plain zip format holds: sizes and offsets in 32 bits, the count of files in 16. */
const MOST_BYTES = 0xffffffff;
const MOST_FILES = 0xffff;

/** What is already compressed gains nothing from deflate: it is stored as it is. */
const PACKED = /\.(png|jpe?g|gif|webp|avif|zip|gz|mp4|mov|mp3|pdf|woff2?)$/i;

const EPOCH_DATE = (1 << 5) | 1; // 1980-01-01: the files carry no time of their own, so two zips of the same content are the same bytes.

type Written = { name: Uint8Array; crc: number; packed: number; size: number; method: number; offset: number };

function header(signature: number, length: number) {
	const bytes = new Uint8Array(length);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, signature, true);
	return { bytes, view };
}

/**
 * A zip as it is written, piece by piece: each file is read, packed and given on before the next is asked for, so an archive of many media
 * files is never held whole. `files` may be any async source (the backup reads each media file from the storage as its turn comes).
 */
export async function* zipStream(files: AsyncIterable<ZipFile> | Iterable<ZipFile>): AsyncGenerator<Uint8Array> {
	const written: Written[] = [];
	let offset = 0;
	const encoder = new TextEncoder();
	for await (const file of files) {
		const name = encoder.encode(file.name);
		const deflated = PACKED.test(file.name) ? null : await through(file.bytes, new CompressionStream("deflate-raw"));
		const packed = deflated && deflated.length < file.bytes.length ? deflated : file.bytes;
		const method = packed === file.bytes ? 0 : 8;
		const crc = crc32(file.bytes);
		// Past these the numbers of the format wrap, and the file would be one nothing can read: it is refused, not written wrong.
		if (written.length >= MOST_FILES || offset + 30 + name.length + packed.length > MOST_BYTES)
			throw new Error("The archive is larger than a zip holds (4 GB, 65,535 files).");
		const local = header(0x04034b50, 30);
		local.view.setUint16(4, 20, true);
		local.view.setUint16(6, 0x0800, true); // names are UTF-8
		local.view.setUint16(8, method, true);
		local.view.setUint16(12, EPOCH_DATE, true);
		local.view.setUint32(14, crc, true);
		local.view.setUint32(18, packed.length, true);
		local.view.setUint32(22, file.bytes.length, true);
		local.view.setUint16(26, name.length, true);
		written.push({ name, crc, packed: packed.length, size: file.bytes.length, method, offset });
		yield local.bytes;
		yield name;
		yield packed;
		offset += 30 + name.length + packed.length;
	}
	const start = offset;
	for (const file of written) {
		const central = header(0x02014b50, 46);
		central.view.setUint16(4, 20, true);
		central.view.setUint16(6, 20, true);
		central.view.setUint16(8, 0x0800, true);
		central.view.setUint16(10, file.method, true);
		central.view.setUint16(14, EPOCH_DATE, true);
		central.view.setUint32(16, file.crc, true);
		central.view.setUint32(20, file.packed, true);
		central.view.setUint32(24, file.size, true);
		central.view.setUint16(28, file.name.length, true);
		central.view.setUint32(42, file.offset, true);
		yield central.bytes;
		yield file.name;
		offset += 46 + file.name.length;
	}
	const end = header(0x06054b50, 22);
	end.view.setUint16(8, written.length, true);
	end.view.setUint16(10, written.length, true);
	end.view.setUint32(12, offset - start, true);
	end.view.setUint32(16, start, true);
	yield end.bytes;
}

/** A zip of a few small files, whole. */
export async function zip(files: Iterable<ZipFile>): Promise<Uint8Array> {
	const parts: Uint8Array[] = [];
	for await (const part of zipStream(files)) parts.push(part);
	const whole = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of parts) {
		whole.set(part, at);
		at += part.length;
	}
	return whole;
}

/** A zip's files as they are listed at its end: each read (and inflated) when it is asked for. `null` when the bytes are no zip. */
export function unzip(
	bytes: Uint8Array,
): { names: string[]; read: (name: string) => Promise<Uint8Array | null> } | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// The end record is the last thing in the file, before at most a 64 KB comment.
	let end = -1;
	for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--)
		if (view.getUint32(at, true) === 0x06054b50) {
			end = at;
			break;
		}
	if (end < 0) return null;
	const count = view.getUint16(end + 10, true);
	let at = view.getUint32(end + 16, true);
	const decoder = new TextDecoder();
	const files = new Map<string, { method: number; packed: number; size: number; offset: number }>();
	for (let index = 0; index < count; index++) {
		if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
		const nameLength = view.getUint16(at + 28, true);
		// One spelling of a name: a zip made on a Mac writes its accented and Korean letters taken apart.
		const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)).normalize("NFC");
		// A folder's own entry holds nothing.
		if (!name.endsWith("/"))
			files.set(name, {
				method: view.getUint16(at + 10, true),
				packed: view.getUint32(at + 20, true),
				size: view.getUint32(at + 24, true),
				offset: view.getUint32(at + 42, true),
			});
		at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
	}
	return {
		names: [...files.keys()],
		async read(name) {
			const file = files.get(name);
			if (!file || file.offset + 30 > bytes.length) return null;
			const start = file.offset + 30 + view.getUint16(file.offset + 26, true) + view.getUint16(file.offset + 28, true);
			const packed = bytes.subarray(start, start + file.packed);
			if (file.method === 0) return packed;
			if (file.method !== 8) return null;
			try {
				return await through(packed, new DecompressionStream("deflate-raw"), file.size);
			} catch {
				return null;
			}
		},
	};
}
