import { type EditorState, Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export function isComposing(view: EditorView, event: KeyboardEvent | Event): boolean {
	if (view.composing) return true;
	if ("isComposing" in event && (event as KeyboardEvent).isComposing) return true;
	if ("keyCode" in event && (event as KeyboardEvent).keyCode === 229) return true;
	return false;
}

export function findCodeBlockDepth(state: EditorState): number | null {
	const { $from } = state.selection;
	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type.name === "codeBlock") return d;
	}
	return null;
}

export function isInCodeBlock(state: EditorState): boolean {
	return findCodeBlockDepth(state) !== null;
}

export function handleTabKey(view: EditorView, event: KeyboardEvent, isShift: boolean): boolean {
	if (isComposing(view, event)) return false;
	const depth = findCodeBlockDepth(view.state);
	if (depth === null) return false;

	event.preventDefault();

	const state = view.state;
	const { $from, $to } = state.selection;
	const blockStart = $from.start(depth);
	const blockEnd = $from.end(depth);
	const text = state.doc.textBetween(blockStart, blockEnd, "\n", "\0");

	const selFrom = $from.pos - blockStart;
	const selTo = $to.pos - blockStart;

	// 각 라인의 [start, end] 오프셋 계산 (blockStart 기준)
	const lines: Array<{ start: number; end: number; text: string }> = [];
	let offset = 0;
	for (const line of text.split("\n")) {
		const start = offset;
		const end = start + line.length;
		lines.push({ start, end, text: line });
		offset = end + 1; // '\n'
	}

	// 선택 영역에 걸치는 라인 인덱스 찾기
	const selectedLineIndices: number[] = [];
	lines.forEach((line, index) => {
		const lineStart = line.start;
		const lineEnd = line.end;
		if (selFrom === selTo) {
			if (selFrom >= lineStart && (selFrom <= lineEnd || index === lines.length - 1)) {
				selectedLineIndices.push(index);
			}
		} else {
			// 범위 선택일 때
			if (lineEnd >= selFrom && lineStart <= selTo) {
				if (selTo === lineStart && selTo > selFrom) {
					// 커서가 라인 시작점에 정확히 닿은 경우 제외
					return;
				}
				selectedLineIndices.push(index);
			}
		}
	});

	if (selectedLineIndices.length === 0) return false;

	if (!isShift) {
		// Tab: 들여쓰기
		if (selFrom === selTo && selectedLineIndices.length === 1) {
			// 단순 커서 위치에서 탭 문자 삽입
			view.dispatch(state.tr.insertText("\t").scrollIntoView());
			return true;
		}

		// 여러 줄 선택 들여쓰기
		let tr = state.tr;
		for (let i = selectedLineIndices.length - 1; i >= 0; i--) {
			const lineIdx = selectedLineIndices[i];
			const line = lines[lineIdx];
			if (!line) continue;
			const pos = blockStart + line.start;
			tr = tr.insertText("\t", pos);
		}

		// 선택 영역 갱신: 첫 라인 들여쓰기 반영
		const firstLine = lines[selectedLineIndices[0]];
		const lastLine = lines[selectedLineIndices[selectedLineIndices.length - 1]];
		if (firstLine && lastLine) {
			const newFrom = blockStart + firstLine.start;
			const addedCount = selectedLineIndices.length;
			const newTo = Math.min(tr.doc.content.size, blockStart + lastLine.end + addedCount);
			tr = tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));
		}

		view.dispatch(tr.scrollIntoView());
		return true;
	}

	// Shift-Tab: 내어쓰기
	let tr = state.tr;
	let changed = false;

	for (let i = selectedLineIndices.length - 1; i >= 0; i--) {
		const lineIdx = selectedLineIndices[i];
		const line = lines[lineIdx];
		if (!line) continue;

		let deleteCount = 0;
		if (line.text.startsWith("\t")) {
			deleteCount = 1;
		} else if (line.text.startsWith("  ")) {
			deleteCount = 2;
		} else if (line.text.startsWith(" ")) {
			deleteCount = 1;
		}

		if (deleteCount > 0) {
			changed = true;
			const pos = blockStart + line.start;
			tr = tr.delete(pos, pos + deleteCount);
		}
	}

	if (!changed) return true;

	view.dispatch(tr.scrollIntoView());
	return true;
}

export function handleEnterKey(view: EditorView, event: KeyboardEvent): boolean {
	if (isComposing(view, event)) return false;
	const depth = findCodeBlockDepth(view.state);
	if (depth === null) return false;

	event.preventDefault();

	const state = view.state;
	const { $from } = state.selection;
	const blockStart = $from.start(depth);
	const textBeforeInBlock = state.doc.textBetween(blockStart, $from.pos, "\n", "\0");

	// 현재 라인의 시작점 찾기
	const lastNewline = textBeforeInBlock.lastIndexOf("\n");
	const currentLineBeforeCursor = lastNewline === -1 ? textBeforeInBlock : textBeforeInBlock.slice(lastNewline + 1);

	// 현재 라인의 앞 공백(들여쓰기) 추출
	const indentMatch = currentLineBeforeCursor.match(/^[\t ]*/);
	const indent = indentMatch ? indentMatch[0] : "";

	const tr = state.tr.replaceSelectionWith(state.schema.text(`\n${indent}`)).scrollIntoView();
	view.dispatch(tr);
	return true;
}

export function handleModAKey(view: EditorView, event: KeyboardEvent): boolean {
	if (isComposing(view, event)) return false;
	const depth = findCodeBlockDepth(view.state);
	if (depth === null) return false;

	event.preventDefault();

	const state = view.state;
	const { $from } = state.selection;
	const start = $from.start(depth);
	const end = $from.end(depth);

	const tr = state.tr.setSelection(TextSelection.create(state.doc, start, end)).scrollIntoView();
	view.dispatch(tr);
	return true;
}

export function handlePaste(view: EditorView, event: ClipboardEvent): boolean {
	if (!isInCodeBlock(view.state)) return false;

	const clipboard = event.clipboardData;
	if (!clipboard) return false;

	const text = clipboard.getData("text/plain");
	if (!text) return false;

	event.preventDefault();

	// \r\n → \n 및 \r → \n 정규화
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	const tr = view.state.tr.replaceSelectionWith(view.state.schema.text(normalized)).scrollIntoView();
	view.dispatch(tr);
	return true;
}

export function createCodeBlockKeysPlugin(): Plugin {
	return new Plugin({
		props: {
			handleKeyDown(view, event) {
				if (isComposing(view, event)) return false;
				if (!isInCodeBlock(view.state)) return false;

				if (event.key === "Tab") {
					return handleTabKey(view, event, event.shiftKey);
				}

				if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
					return handleEnterKey(view, event);
				}

				if (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey)) {
					return handleModAKey(view, event);
				}

				return false;
			},
			handlePaste(view, event) {
				return handlePaste(view, event);
			},
		},
	});
}
