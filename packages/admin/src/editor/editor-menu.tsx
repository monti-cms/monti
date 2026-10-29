"use client";

import { DropdownMenuCheckboxItem, DropdownMenuItem } from "@monti-cms/ui";
import type { EditorMenuItem } from "../admin-components";
import { EditorWidthSubmenu } from "./editor-width";

/**
 * The document-tools group of an editor's ⋯ menu: the rows extensions and the screen add (view switches such as "View as MDX", "Translate all"),
 * then "Body width ▸". A row with `checked` is a switch with a ✓ while on.
 */
export function EditorMenuRows({ items = [] }: { items?: readonly EditorMenuItem[] }) {
	return (
		<>
			{items.map((item) =>
				item.checked === undefined ? (
					<DropdownMenuItem key={item.key} caption={item.caption} onClick={item.onSelect}>
						{item.icon}
						{item.label}
					</DropdownMenuItem>
				) : (
					<DropdownMenuCheckboxItem key={item.key} checked={item.checked} onCheckedChange={item.onSelect}>
						{item.icon}
						{item.label}
					</DropdownMenuCheckboxItem>
				),
			)}
			<EditorWidthSubmenu />
		</>
	);
}
