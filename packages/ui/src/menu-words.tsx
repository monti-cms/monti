import * as React from "react";
import { CutWords } from "./cut-words";

/**
 * The words of a menu row. A row's name that runs past its card ends in "…" and says itself whole to the pointer and the keyboard, as every cut
 * word of the admin does (`CutWords`); the icon, the value and the key at its end are not touched. Every row part (menu, context menu, select,
 * combobox, command, pick list) puts its children through this one function.
 */
export function menuWords(children: React.ReactNode): React.ReactNode {
	return React.Children.map(children, (child) =>
		typeof child === "string" || typeof child === "number" ? <CutWords>{child}</CutWords> : child,
	);
}
