/** A decoded image: RGBA bytes, row by row. */
export interface Pixels {
	readonly width: number;
	readonly height: number;
	readonly data: Uint8Array;
}

/** What a comparison found. */
export interface Comparison {
	/** Pixels that differ and have no match within the allowed shift, in the area both images cover. */
	readonly differing: number;
	/** Pixels compared: the area both images cover. */
	readonly compared: number;
	/** The images differ in size by more than the allowed shift: a part grew or a row was added. */
	readonly sizeChanged: boolean;
	/** The differing pixels, red on a faded copy of the expected image. Only made when something differs. */
	readonly diff: Pixels | null;
}

export interface CompareOptions {
	/** How far a pixel may move, in px, and still count as the same. */
	readonly shift: number;
	/** How far two colors may be apart and count as the same, 0 to 1 (pixelmatch's YIQ distance). */
	readonly threshold: number;
}

/** pixelmatch's measure: the squared YIQ distance of two colors, blended on white. 35215 is the largest it can be. */
const MAX_DELTA = 35215;
const blend = (channel: number, alpha: number) => 255 + ((channel - 255) * alpha) / 255;
const delta = (a: Uint8Array, i: number, b: Uint8Array, j: number) => {
	const r = blend(a[i] ?? 0, a[i + 3] ?? 0) - blend(b[j] ?? 0, b[j + 3] ?? 0);
	const g = blend(a[i + 1] ?? 0, a[i + 3] ?? 0) - blend(b[j + 1] ?? 0, b[j + 3] ?? 0);
	const bl = blend(a[i + 2] ?? 0, a[i + 3] ?? 0) - blend(b[j + 2] ?? 0, b[j + 3] ?? 0);
	const y = r * 0.29889531 + g * 0.58662247 + bl * 0.11448223;
	const iq = r * 0.59597799 - g * 0.2741761 - bl * 0.32180189;
	const q = r * 0.21147017 - g * 0.52261711 + bl * 0.31114694;
	return 0.5053 * y * y + 0.299 * iq * iq + 0.1957 * q * q;
};

/**
 * Compares two shots, letting a part move by up to `shift` px. A pixel counts as the same when the other image has a pixel of its color within
 * `shift` px of it, both ways: what the new shot shows is somewhere near in the old one, and what the old one showed is near in the new one. So a
 * card that lands 1px lower passes, while a new color, a changed word or a part moved further fails. The images may differ in size by `shift` px
 * (a page 1px taller); more than that is a change by itself.
 */
export const compareShots = (expected: Pixels, actual: Pixels, { shift, threshold }: CompareOptions): Comparison => {
	const width = Math.min(expected.width, actual.width);
	const height = Math.min(expected.height, actual.height);
	const sizeChanged =
		Math.abs(expected.width - actual.width) > shift || Math.abs(expected.height - actual.height) > shift;
	const limit = MAX_DELTA * threshold * threshold;
	const at = (image: Pixels, x: number, y: number) => (y * image.width + x) * 4;

	/** Whether `image` has, within `shift` px of (x, y), a pixel of the color `from` has at (x, y). */
	const near = (from: Pixels, image: Pixels, x: number, y: number) => {
		const i = at(from, x, y);
		for (let dy = -shift; dy <= shift; dy++) {
			const ny = y + dy;
			if (ny < 0 || ny >= image.height) continue;
			for (let dx = -shift; dx <= shift; dx++) {
				const nx = x + dx;
				if (nx < 0 || nx >= image.width) continue;
				if (delta(from.data, i, image.data, at(image, nx, ny)) <= limit) return true;
			}
		}
		return false;
	};

	const marks: number[] = [];
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			if (delta(expected.data, at(expected, x, y), actual.data, at(actual, x, y)) <= limit) continue;
			if (near(actual, expected, x, y) && near(expected, actual, x, y)) continue;
			marks.push(y * width + x);
		}

	return {
		differing: marks.length,
		compared: width * height,
		sizeChanged,
		diff: marks.length > 0 || sizeChanged ? drawDiff(expected, width, height, marks) : null,
	};
};

/** The expected image in faded gray, with each differing pixel in red. */
const drawDiff = (expected: Pixels, width: number, height: number, marks: readonly number[]): Pixels => {
	const data = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const from = (y * expected.width + x) * 4;
			const luma =
				0.29889531 * (expected.data[from] ?? 0) +
				0.58662247 * (expected.data[from + 1] ?? 0) +
				0.11448223 * (expected.data[from + 2] ?? 0);
			const gray = blend(luma, 25);
			data.set([gray, gray, gray, 255], (y * width + x) * 4);
		}
	for (const mark of marks) data.set([255, 0, 0, 255], mark * 4);
	return { width, height, data };
};
