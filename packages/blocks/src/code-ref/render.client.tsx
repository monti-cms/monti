"use client";

import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { findAnchorLines, focusLines, isOnScreen, revealLines } from "./dom";

/** 누른 뒤 강조를 남겨 두는 시간(ms). */
const FOCUS_MS = 2500;

/**
 * 본문 글자와 코드 줄의 연결(`:code-ref[글자]{to="c1"}`). 글자에 마우스를 올리거나 초점을 두면 연결된 코드 줄을 강조하고
 * 같은 코드 블록의 나머지 줄을 흐린다(`pre[data-code-focus]`·`.line[data-focused]`, `@monti-cms/core/render.css`).
 * 누르거나 Enter·Space를 누르면 코드가 화면 밖일 때 그 줄로 옮겨(접힌 곳은 펼친다) 잠시 강조를 남긴다.
 * 연결된 줄을 찾지 못하면(지워진 이름표) 연결 없는 글자로 보인다.
 */
export function CodeRef({ to, children }: PropsWithChildren<{ to: string }>) {
	const [broken, setBroken] = useState(false);
	const clearRef = useRef<(() => void) | null>(null);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => {
		setBroken(findAnchorLines(to).length === 0);
	}, [to]);

	const clear = useCallback(() => {
		window.clearTimeout(timer.current);
		clearRef.current?.();
		clearRef.current = null;
	}, []);

	useEffect(() => clear, [clear]);

	/** 연결된 줄을 강조한다. `timed`면 잠시 뒤 거둔다. 줄을 찾으면 그 줄을 돌려준다. */
	const focus = useCallback(
		(timed: boolean) => {
			const lines = findAnchorLines(to);
			if (lines.length === 0) return lines;
			clear();
			clearRef.current = focusLines(lines);
			if (timed) timer.current = window.setTimeout(clear, FOCUS_MS);
			return lines;
		},
		[clear, to],
	);

	const activate = () => {
		const lines = findAnchorLines(to);
		if (lines.length === 0) return;
		if (!isOnScreen(lines)) revealLines(lines);
		focus(true);
	};

	if (broken) return <>{children}</>;

	return (
		// biome-ignore lint/a11y/useSemanticElements: 문장 안의 글자라 button 대신 span에 역할을 준다
		<span
			role="button"
			tabIndex={0}
			className="cms-block-code-ref"
			data-code-ref={to}
			onPointerEnter={(event) => event.pointerType === "mouse" && focus(false)}
			onPointerLeave={(event) => event.pointerType === "mouse" && clear()}
			onFocus={() => focus(false)}
			onBlur={clear}
			onClick={activate}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				activate();
			}}
		>
			{children}
		</span>
	);
}
