"use client";

// design-system: drawing — extra room after the last block so the source can scroll as far as the translation does (35% of the viewport, in step with the editor).

import type { ReactNode } from "react";

export function ScrollRoom({ children }: { children: ReactNode }) {
	return <div className="pb-[35vh]">{children}</div>;
}
