"use client";

import { useEffect } from "react";

const PROPERTY = "--monti-content-font";

/**
 * Hands the site's body font to the writing area. The admin chrome uses `--monti-font-sans`, but the post title and body should look like the blog,
 * so the font the site's `body` computes to is copied into `--monti-content-font` on `html`. A site that sets the property itself keeps its value.
 */
export function ContentFont() {
	useEffect(() => {
		const root = document.documentElement;
		if (getComputedStyle(root).getPropertyValue(PROPERTY).trim() !== "") return;
		const font = getComputedStyle(document.body).fontFamily;
		if (!font) return;
		root.style.setProperty(PROPERTY, font);
		return () => {
			root.style.removeProperty(PROPERTY);
		};
	}, []);
	return null;
}
