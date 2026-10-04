/** Size info for one item placed on the toolbar. `divider` is the separator between groups. */
export interface FitItem {
	key: string;
	/** Larger values are hidden first. */
	priority: number;
	/** If true, never hidden even when narrow. */
	fixed?: boolean;
	width: number;
	divider?: boolean;
}

/**
 * Decides which items to actually draw from the visible tool keys.
 * A divider is drawn only when there are visible tools on both sides, and only one is drawn when several come in a row.
 */
export function layoutKeys(items: FitItem[], visible: ReadonlySet<string>): string[] {
	const out: string[] = [];
	let pending: string | null = null;
	let lastWasTool = false;
	for (const item of items) {
		if (item.divider) {
			if (lastWasTool) pending = item.key;
			continue;
		}
		if (!visible.has(item.key)) continue;
		if (pending) out.push(pending);
		pending = null;
		out.push(item.key);
		lastWasTool = true;
	}
	return out;
}

/**
 * Hides tools starting from the lowest priority (largest number) until the rest fit the available width, and returns the keys of the remaining tools.
 * If any tool is hidden, the "More" button (`overflowWidth`) also takes one slot. `gap` is the spacing between items.
 * On equal priority, later tools are hidden first. If it still overflows with only pinned tools left, it is left as is.
 */
export function fitSlots(items: FitItem[], available: number, overflowWidth: number, gap = 0): Set<string> {
	const widths = new Map(items.map((item) => [item.key, item.width]));
	const visible = new Set(items.filter((item) => !item.divider).map((item) => item.key));
	const total = (hasOverflow: boolean) => {
		const keys = layoutKeys(items, visible);
		const count = keys.length + (hasOverflow ? 1 : 0);
		const sum = keys.reduce((acc, key) => acc + (widths.get(key) ?? 0), 0) + (hasOverflow ? overflowWidth : 0);
		return sum + gap * Math.max(0, count - 1);
	};
	let hiddenCount = 0;
	while (total(hiddenCount > 0) > available) {
		let target: FitItem | undefined;
		for (const item of items) {
			if (item.divider || item.fixed || !visible.has(item.key)) continue;
			if (!target || item.priority >= target.priority) target = item;
		}
		if (!target) break;
		visible.delete(target.key);
		hiddenCount += 1;
	}
	return visible;
}
