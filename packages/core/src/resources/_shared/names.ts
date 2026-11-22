/** The first of `base`, `<base>-2`, `<base>-3`… that `taken` does not have. */
export function firstFree(base: string, taken: ReadonlySet<string>): string {
	let name = base;
	for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
	return name;
}
