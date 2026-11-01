/**
 * The overlapping-entry zip bomb: every entry of the central directory points at the same stored megabyte, so an archive of about 1 MB reads as
 * more than `limit` bytes. It tests an inflate cap without allocating what the cap guards against.
 */
export function overlappingZip(limit: number): Uint8Array {
	const encode = (text: string) => new TextEncoder().encode(text);
	const size = 1024 * 1024;
	const count = Math.floor(limit / size) + 1;
	const name = (index: number) => encode(`bomb/${index}.bin`);
	const local = new Uint8Array(30 + name(0).length + size);
	const localView = new DataView(local.buffer);
	localView.setUint32(0, 0x04034b50, true);
	localView.setUint32(18, size, true);
	localView.setUint32(22, size, true);
	localView.setUint16(26, name(0).length, true);
	local.set(name(0), 30);
	const central = Array.from({ length: count }, (_, index) => {
		const header = new Uint8Array(46 + name(index).length);
		const view = new DataView(header.buffer);
		view.setUint32(0, 0x02014b50, true);
		view.setUint32(20, size, true);
		view.setUint32(24, size, true);
		view.setUint16(28, name(index).length, true);
		header.set(name(index), 46);
		return header;
	});
	const centralSize = central.reduce((sum, header) => sum + header.length, 0);
	const end = new Uint8Array(22);
	const endView = new DataView(end.buffer);
	endView.setUint32(0, 0x06054b50, true);
	endView.setUint16(8, count, true);
	endView.setUint16(10, count, true);
	endView.setUint32(12, centralSize, true);
	endView.setUint32(16, local.length, true);
	const zip = new Uint8Array(local.length + centralSize + end.length);
	zip.set(local, 0);
	let offset = local.length;
	for (const header of central) {
		zip.set(header, offset);
		offset += header.length;
	}
	zip.set(end, offset);
	return zip;
}
