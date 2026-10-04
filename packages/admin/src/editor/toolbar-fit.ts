/** 툴바에 놓을 항목 하나의 크기 정보. `divider`는 그룹 사이 구분선이다. */
export interface FitItem {
	key: string;
	/** 클수록 먼저 숨긴다. */
	priority: number;
	/** 참이면 좁아도 숨기지 않는다. */
	fixed?: boolean;
	width: number;
	divider?: boolean;
}

/**
 * 보이는 도구 키로 실제 그릴 항목을 정한다.
 * 구분선은 양쪽에 보이는 도구가 있을 때만 그리고, 연달아 나오면 하나만 그린다.
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
 * 가용 폭에 들어가도록 우선순위가 낮은(숫자가 큰) 도구부터 숨기고, 남는 도구의 키를 돌려준다.
 * 숨긴 도구가 있으면 "더보기" 버튼(`overflowWidth`)도 한 칸 차지한다. `gap`은 항목 사이 간격이다.
 * 우선순위가 같으면 뒤쪽 도구를 먼저 숨긴다. 고정 도구만 남아도 넘치면 그대로 둔다.
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
