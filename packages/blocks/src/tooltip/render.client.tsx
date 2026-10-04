"use client";

import { type PropsWithChildren, useId, useRef, useState } from "react";

/**
 * 툴팁(`:tooltip[글자]{content="설명"}`). 마우스를 올리거나 키보드로 초점을 두면 설명을 보이고, 터치는 눌러서 열고 닫는다.
 * Esc로 닫는다. 설명은 숨겨 두어도 `aria-describedby`로 스크린 리더가 읽는다. `note`는 코드 안 툴팁의 주석 번호로,
 * 터치 기기에서만 글자 옆에 번호를 보인다(CSS).
 */
export function Tooltip({ content, note, children }: PropsWithChildren<{ content?: string; note?: string | number }>) {
	const id = useId();
	const [open, setOpen] = useState(false);
	// 터치로 누르는 중인지. 터치는 누르면 초점도 가서 열렸다 바로 닫히지 않게 누름 하나로 한 번만 바꾼다.
	const touching = useRef(false);

	return (
		<span
			className="cms-block-tooltip"
			data-open={open ? "" : undefined}
			onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
			onPointerLeave={(event) => event.pointerType === "mouse" && setOpen(false)}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: 문장 안의 글자라 button 대신 span이 마우스·터치·초점을 받는다 */}
			<span
				className="cms-block-tooltip-trigger"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: 키보드로도 설명을 열 수 있게 초점을 받는다
				tabIndex={0}
				aria-describedby={id}
				onPointerDown={(event) => {
					touching.current = event.pointerType !== "mouse";
				}}
				onClick={() => {
					if (!touching.current) return;
					touching.current = false;
					setOpen((current) => !current);
				}}
				onFocus={() => {
					if (!touching.current) setOpen(true);
				}}
				onBlur={() => {
					touching.current = false;
					setOpen(false);
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") setOpen(false);
				}}
			>
				{children}
				{note ? (
					<sup aria-hidden className="cms-block-tooltip-note">
						{note}
					</sup>
				) : null}
			</span>
			<span id={id} role="tooltip" className="cms-block-tooltip-content">
				{content}
			</span>
		</span>
	);
}
