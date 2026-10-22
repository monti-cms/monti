"use client";

import type { ReactNode } from "react";

export function ScrollRoom({ children }: { children: ReactNode }) {
	return <div className="pb-[35vh]">{children}</div>;
}
