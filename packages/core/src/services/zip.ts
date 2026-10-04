import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * 결정적(deterministic) ZIP writer.
 *
 * 내보내기 아카이브는 스냅샷 테스트가 가능해야 하므로 같은 입력이면 항상 같은 바이트를 만든다.
 * - 압축은 deflate 고정 레벨 9를 사용한다(같은 zlib에서 결정적).
 * - 파일 시각은 호출자가 고정값을 넘긴다(기본 1980-01-01, ZIP epoch).
 * - 파일 순서는 호출자가 정렬해 넘긴다.
 */
export interface ZipEntry {
	/** ZIP 내부 경로. `/` 구분자, 앞 슬래시 없음. */
	path: string;
	data: Uint8Array;
}

const ZIP_EPOCH = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i += 1) {
		let c = i;
		for (let k = 0; k < 8; k += 1) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c >>> 0;
	}
	return table;
})();

export const crc32 = (data: Uint8Array): number => {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i += 1) {
		crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date: Date): { time: number; date: number } => {
	const year = date.getUTCFullYear();
	if (year < 1980) return dosDateTime(ZIP_EPOCH);
	const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
	const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
	return { time, date: dosDate };
};

const writeUint16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const writeUint32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

export function createZipArchive(entries: readonly ZipEntry[], options?: { modifiedAt?: Date }): Uint8Array {
	const modifiedAt = options?.modifiedAt ?? ZIP_EPOCH;
	const { time, date } = dosDateTime(modifiedAt);

	const encoder = new TextEncoder();
	const localParts: Uint8Array[] = [];
	const centralParts: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const nameBytes = encoder.encode(entry.path);
		const compressed = deflateRawSync(entry.data, { level: 9 });
		const crc = crc32(entry.data);

		const localHeader = new Uint8Array(30 + nameBytes.length);
		const localView = new DataView(localHeader.buffer);
		writeUint32(localView, 0, 0x04034b50);
		writeUint16(localView, 4, 20);
		writeUint16(localView, 6, 0x0800); // UTF-8 파일명
		writeUint16(localView, 8, 8); // deflate
		writeUint16(localView, 10, time);
		writeUint16(localView, 12, date);
		writeUint32(localView, 14, crc);
		writeUint32(localView, 18, compressed.length);
		writeUint32(localView, 22, entry.data.length);
		writeUint16(localView, 26, nameBytes.length);
		writeUint16(localView, 28, 0);
		localHeader.set(nameBytes, 30);

		localParts.push(localHeader, compressed);

		const centralHeader = new Uint8Array(46 + nameBytes.length);
		const centralView = new DataView(centralHeader.buffer);
		writeUint32(centralView, 0, 0x02014b50);
		writeUint16(centralView, 4, 20);
		writeUint16(centralView, 6, 20);
		writeUint16(centralView, 8, 0x0800);
		writeUint16(centralView, 10, 8);
		writeUint16(centralView, 12, time);
		writeUint16(centralView, 14, date);
		writeUint32(centralView, 16, crc);
		writeUint32(centralView, 20, compressed.length);
		writeUint32(centralView, 24, entry.data.length);
		writeUint16(centralView, 28, nameBytes.length);
		writeUint16(centralView, 30, 0);
		writeUint16(centralView, 32, 0);
		writeUint16(centralView, 34, 0);
		writeUint16(centralView, 36, 0);
		writeUint32(centralView, 38, 0);
		writeUint32(centralView, 42, offset);
		centralHeader.set(nameBytes, 46);
		centralParts.push(centralHeader);

		offset += localHeader.length + compressed.length;
	}

	const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
	const endRecord = new Uint8Array(22);
	const endView = new DataView(endRecord.buffer);
	writeUint32(endView, 0, 0x06054b50);
	writeUint16(endView, 4, 0);
	writeUint16(endView, 6, 0);
	writeUint16(endView, 8, entries.length);
	writeUint16(endView, 10, entries.length);
	writeUint32(endView, 12, centralSize);
	writeUint32(endView, 16, offset);
	writeUint16(endView, 20, 0);

	const all = [...localParts, ...centralParts, endRecord];
	const total = all.reduce((sum, part) => sum + part.length, 0);
	const output = new Uint8Array(total);
	let cursor = 0;
	for (const part of all) {
		output.set(part, cursor);
		cursor += part.length;
	}
	return output;
}

export interface ZipReadEntry {
	path: string;
	data: Uint8Array;
}

/**
 * 테스트·검증용 최소 ZIP 리더. 중앙 디렉터리만 읽고 deflate 항목을 푼다.
 * 내보내기 아카이브 검증 외 용도로는 쓰지 않는다.
 */
export function readZipArchive(buffer: Uint8Array): ZipReadEntry[] {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const decoder = new TextDecoder();

	let endOffset = -1;
	for (let i = buffer.length - 22; i >= 0; i -= 1) {
		if (view.getUint32(i, true) === 0x06054b50) {
			endOffset = i;
			break;
		}
	}
	if (endOffset < 0) throw new Error("ZIP end of central directory not found");

	const total = view.getUint16(endOffset + 10, true);
	let cursor = view.getUint32(endOffset + 16, true);
	const entries: ZipReadEntry[] = [];

	for (let index = 0; index < total; index += 1) {
		if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Invalid central directory header");
		const method = view.getUint16(cursor + 10, true);
		const compressedSize = view.getUint32(cursor + 20, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extraLength = view.getUint16(cursor + 30, true);
		const commentLength = view.getUint16(cursor + 32, true);
		const localOffset = view.getUint32(cursor + 42, true);
		const path = decoder.decode(buffer.subarray(cursor + 46, cursor + 46 + nameLength));

		const localNameLength = view.getUint16(localOffset + 26, true);
		const localExtraLength = view.getUint16(localOffset + 28, true);
		const dataStart = localOffset + 30 + localNameLength + localExtraLength;
		const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
		const data = method === 0 ? compressed : new Uint8Array(inflateRawSync(compressed));

		entries.push({ path, data });
		cursor += 46 + nameLength + extraLength + commentLength;
	}

	return entries;
}
