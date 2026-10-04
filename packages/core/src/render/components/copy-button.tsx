"use client";

import { useState } from "react";

/** 코드 복사 단추. 복사하면 잠깐 `copiedLabel`을 보인다. */
export function CmsCopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className="cms-code-copy"
			aria-label={label}
			onClick={async () => {
				if (copied) return;
				try {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 1200);
				} catch {
					// 클립보드를 쓸 수 없는 곳(권한·http)에서는 아무것도 하지 않는다.
				}
			}}
		>
			{copied ? copiedLabel : label}
		</button>
	);
}
