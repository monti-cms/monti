/**
 * The screen spec: a screen written as data, drawn by `ScreenSpec` with the design system's parts. It names parts, their options and what they read; it never
 * carries a class, a style or a number of pixels, so a screen written this way cannot leave the design system. The rules are in docs/design/admin/screen-spec.md.
 */

/** The steps of the spacing scale a `Spacing` can take (the design system's spacing tokens, without 0). */
export const SPACING_STEPS = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48] as const;
export type SpacingStep = (typeof SPACING_STEPS)[number];

/** A value read from the screen's data by a JSON pointer (`/errors/email`). */
export interface DataValue {
	readonly data: string;
}

/** A value of the item a repeated element is drawn for (`/title` of one row), by a JSON pointer into the item. */
export interface ItemValue {
	readonly item: string;
}

/** A text of the screen's dictionary, in the admin's language (`signIn`), with the values its placeholders take. */
export interface TextValue {
	readonly text: string;
	readonly params?: Readonly<Record<string, string | number | DataValue | ItemValue>>;
}

/** A thing the screen does, by name (`signIn`): the page says what it is (the address a form posts to). */
export interface ActionValue {
	readonly action: string;
}

export type SpecValue = string | number | boolean | DataValue | ItemValue | TextValue | ActionValue;

/** Empty space in a container's children: between two children it is the space between them, first or last it is the container's inset on that end. */
export interface SpacingItem {
	readonly spacing: SpacingStep;
}

/** A child: another element by its id, empty space, or a text drawn as it is. */
export type SpecChild = string | SpacingItem | DataValue | ItemValue | TextValue;

/** Shown only when this holds: `{ data }` when the value is there (not empty, not false), `{ not }` the opposite. */
export type Visible = DataValue | ItemValue | { readonly not: Visible };

export interface SpecElement {
	readonly type: string;
	readonly props?: Readonly<Record<string, SpecValue>>;
	readonly children?: readonly SpecChild[];
	/** The pattern's named places (a page header's `title`, a row title's `address`), each filled with elements by id or a text. */
	readonly slots?: Readonly<Record<string, readonly Exclude<SpecChild, SpacingItem>[]>>;
	readonly visible?: Visible;
	/** Drawn once for each item of this list (`{ "data": "/rows" }`); inside it, `{ "item": "/title" }` reads the item. */
	readonly repeat?: DataValue;
}

export interface ScreenSpecDocument {
	readonly root: string;
	readonly elements: Readonly<Record<string, SpecElement>>;
}

export const isSpacing = (child: SpecChild): child is SpacingItem => typeof child === "object" && "spacing" in child;
export const isData = (value: unknown): value is DataValue =>
	typeof value === "object" && value !== null && "data" in value;
export const isItem = (value: unknown): value is ItemValue =>
	typeof value === "object" && value !== null && "item" in value;
export const isText = (value: unknown): value is TextValue =>
	typeof value === "object" && value !== null && "text" in value;
export const isAction = (value: unknown): value is ActionValue =>
	typeof value === "object" && value !== null && "action" in value;
