"use client";

import { useEffect } from "react";

const PROPERTY = "--monti-content-font";
const MONO_PROPERTY = "--monti-content-mono-font";

/**
 * Hands the site's fonts to the writing area. The admin chrome uses `--monti-font-sans` and `--monti-font-mono`, but the post title, body and its
 * code should look like the blog, so the fonts the site gives `body` and a `code` element are copied into `--monti-content-font` and
 * `--monti-content-mono-font` on `html`. A site that sets a property itself keeps its value.
 */
export function ContentFont() {
	useEffect(() => {
		const root = document.documentElement;
		const set: string[] = [];
		const copy = (property: string, font: string | undefined) => {
			if (!font || getComputedStyle(root).getPropertyValue(property).trim() !== "") return;
			root.style.setProperty(property, font);
			set.push(property);
		};
		copy(PROPERTY, getComputedStyle(document.body).fontFamily);
		// A `code` outside the admin container computes to the site's code font (its own rule, or the reset's).
		const probe = document.createElement("code");
		probe.hidden = true;
		document.body.append(probe);
		copy(MONO_PROPERTY, getComputedStyle(probe).fontFamily);
		probe.remove();
		return () => {
			for (const property of set) root.style.removeProperty(property);
		};
	}, []);
	return null;
}
