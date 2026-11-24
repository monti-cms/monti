import type * as React from "react";
import { cn } from "./cn";

/**
 * 설정 한 줄: 앞에 `lead`(사람 표시), 이름(14px 500 먹색)과 그 아래 무엇을 하는지(13px `fg-subtle`, 2px 아래), 끝에 `control`(스위치, 버튼).
 * 이름은 줄이 모자라면 줄을 바꾼다(말줄임 없음). 스위치 줄은 이름 줄에 스위치를 세우고(`align="start"`), 버튼 줄은 가운데에 세운다(`center`).
 * `tone="danger"`: 지우는 일의 줄(컬렉션 지우기). 위험색 30%의 테두리를 두른 `radius-lg` 상자에 안쪽 16px, 이름은 600이다. 상자 안의 버튼은 6px 모서리다.
 */
function SettingRow({
	title,
	description,
	lead,
	control,
	align = "start",
	tone,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title" | "children"> & {
	title: React.ReactNode;
	description?: React.ReactNode;
	lead?: React.ReactNode;
	control?: React.ReactNode;
	align?: "start" | "center";
	tone?: "danger";
}) {
	return (
		<div
			data-slot="setting-row"
			data-tone={tone}
			data-shape={tone === "danger" ? "square" : undefined}
			className={cn(
				"flex gap-monti-16",
				align === "center" || tone === "danger" ? "items-center" : "items-start",
				tone === "danger" && "rounded-monti-lg border border-monti-danger/30 p-monti-16",
				className,
			)}
			{...props}
		>
			{lead}
			<div className="min-w-0 flex-1">
				<div className={cn("text-monti-body text-monti-default", tone === "danger" ? "font-semibold" : "font-medium")}>
					{title}
				</div>
				{description && <div className="mt-monti-2 text-monti-label text-monti-subtle">{description}</div>}
			</div>
			{control && (
				<div className={cn("flex shrink-0 items-center", align === "start" && tone !== "danger" && "h-5")}>
					{control}
				</div>
			)}
		</div>
	);
}

export { SettingRow };
