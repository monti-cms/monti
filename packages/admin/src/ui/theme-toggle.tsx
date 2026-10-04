"use client";

import { createTranslator } from "@monti-cms/core/client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useHydrated } from "../lib/hooks/use-hydrated";
import { cn } from "../lib/utils/cn";
import { Button, buttonVariants } from "./button";
import { uiMessages } from "./messages";

const t = createTranslator(uiMessages);

/**
 * 밝은·어두운 테마 전환 버튼. 서버 렌더에서는 현재 테마를 알 수 없고, 서버에서 그린 버튼이
 * 뒤따르는 요소의 자동 ID(useId)를 브라우저와 다르게 만들었다(hydration 불일치). 그래서 hydration이
 * 끝날 때까지는 같은 크기의 자리표시를 두고, 그 뒤에 실제 버튼을 그린다.
 */
export function ThemeToggle({
	className,
	labels = { toLight: t("theme.toLight"), toDark: t("theme.toDark") },
	...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
	/** 버튼 이름. 공개 블로그는 화면 언어의 문구를 넘긴다(v2 B4). */
	labels?: { toLight: string; toDark: string };
}) {
	const { resolvedTheme, setTheme } = useTheme();
	const hydrated = useHydrated();
	if (!hydrated) {
		return <span aria-hidden className={cn(buttonVariants({ variant: "ghost", size: "icon" }), className)} />;
	}
	const isDark = resolvedTheme === "dark";
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			aria-label={isDark ? labels.toLight : labels.toDark}
			className={className}
			{...props}
		>
			{isDark ? <Moon aria-hidden className="h-5 w-5" /> : <Sun aria-hidden className="h-5 w-5" />}
		</Button>
	);
}
