import type * as React from "react";
import { cn } from "./cn";

/**
 * 주소 설정 아래의 예시 상자: 그 설정으로 공개 주소가 어떻게 되는지 줄마다 보인다(설정 › 사이트의 "주소에 언어 표시", 컬렉션의 공개 주소).
 * 도구 바탕, `radius-md`, 안쪽 위아래 10px · 양옆 12px, 줄 사이 4px. 줄은 {@link AddressExampleRow}다. 이름 열은 72px, `label="short"`면
 * 한 글자("예")가 서는 44px이다.
 */
function AddressExample({
	label = "default",
	className,
	...props
}: React.ComponentProps<"div"> & { label?: "default" | "short" }) {
	return (
		<div
			data-slot="address-example"
			className={cn(
				"grid gap-y-monti-4 rounded-monti-md bg-monti-tool px-monti-12 py-monti-10 text-monti-caption text-monti-subtle",
				label === "short" ? "grid-cols-[44px_minmax(0,1fr)]" : "grid-cols-[72px_minmax(0,1fr)]",
				className,
			)}
			{...props}
		/>
	);
}

/** 예시 한 줄: 이름(언어 이름, "예")과 주소. 주소는 mono 12/16이고, 설정이 바꾸는 토막은 {@link AddressPart}로 감싼다. */
function AddressExampleRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
	return (
		<>
			<span data-slot="address-example-label" className="leading-4">
				{label}
			</span>
			<span data-slot="address-example-address" className="min-w-0 truncate font-mono text-monti-muted leading-4">
				{children}
			</span>
		</>
	);
}

/** 주소에서 설정이 정하는 토막("en", "articles"): 먹색 600, 고른 바탕, 3px 모서리, 양옆 2px. */
function AddressPart({ className, ...props }: React.ComponentProps<"b">) {
	return (
		<b
			data-slot="address-part"
			className={cn("rounded-[3px] bg-monti-selected px-[2px] font-semibold text-monti-default", className)}
			{...props}
		/>
	);
}

export { AddressExample, AddressExampleRow, AddressPart };
