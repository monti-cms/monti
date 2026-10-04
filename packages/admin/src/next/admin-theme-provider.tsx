"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode, useEffect } from "react";

/**
 * 관리자 화면의 테마 공급자(`next-themes`, `html`에 `dark` 클래스와 `color-scheme`을 붙인다).
 * 관리자를 떠나면(예: 같은 루트 레이아웃을 쓰는 공개 화면으로 이동) 공급자가 `html`에 남긴 값을 지운다.
 * 지우지 않으면 공개 화면이 어두운 배경과 밝은 테마용 글자색으로 보인다.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
	useEffect(() => {
		const root = document.documentElement;
		return () => {
			root.classList.remove("dark", "light");
			root.style.removeProperty("color-scheme");
		};
	}, []);
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			{children}
		</ThemeProvider>
	);
}
