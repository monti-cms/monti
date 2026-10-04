/** 목록 행을 폴더로 끌어 옮길 때 쓰는 데이터 형식(§3.3 "글은 드래그 또는 일괄 이동 메뉴로 이동"). */
export const ENTRY_DRAG_TYPE = "application/x-cms-entries";

export type DraggedEntry = { id: string; expectedVersion: number };

/**
 * 끌기 데이터를 싣고, 끄는 동안 커서 옆에 작은 이름표를 보인다. 표의 행(`tr`)을 그대로 끌기 이미지로 쓰면
 * 브라우저가 그 영역에 겹친 화면(사이드바·머리글)까지 찍어 큰 조각이 따라다닌다.
 */
export function writeDraggedEntries(event: React.DragEvent, entries: DraggedEntry[], label: string) {
	event.dataTransfer.setData(ENTRY_DRAG_TYPE, JSON.stringify(entries));
	event.dataTransfer.effectAllowed = "move";
	const image = document.createElement("div");
	image.textContent = label;
	image.className =
		"pointer-events-none fixed -top-96 left-0 max-w-64 truncate rounded-md border bg-cms-popover px-2.5 py-1 text-cms-popover-foreground text-xs shadow-md";
	document.body.append(image);
	event.dataTransfer.setDragImage?.(image, 12, 12);
	// 브라우저는 끌기를 시작할 때 이미지를 찍어 두므로 바로 지워도 된다.
	setTimeout(() => image.remove(), 0);
}

export function readDraggedEntries(event: React.DragEvent): DraggedEntry[] {
	try {
		const parsed = JSON.parse(event.dataTransfer.getData(ENTRY_DRAG_TYPE) || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const isEntryDrag = (event: React.DragEvent) => event.dataTransfer.types.includes(ENTRY_DRAG_TYPE);
