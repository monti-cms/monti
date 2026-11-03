/**
 * The screen spec: a screen written as data, drawn by `ScreenSpec` with the design system's parts. It names parts, their options and what they read; it never
 * carries a class, a style, a distance in pixels or a raw HTML attribute, so a screen written this way cannot leave the design system. The rules are in
 * docs/design/admin/screen-spec.md.
 */

/** The steps of the spacing scale a `Spacing` can take (the design system's spacing tokens, without 0). */
export const SPACING_STEPS = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48] as const;
export type SpacingStep = (typeof SPACING_STEPS)[number];

/** A value read from the screen's data (its state) by a JSON pointer (`/user/email`). */
export interface StateValue {
	readonly state: string;
}

/** A value of the item a repeated element is drawn for (`/title` of one row), by a JSON pointer into the item. */
export interface ItemValue {
	readonly item: string;
}

/** A text of the screen's dictionary by its key (`login.or`), in the admin's language. */
export interface TextValue {
	readonly text: string;
}

/**
 * A text of the dictionary with values in its placeholders: `{ "template": "login.welcome", "values": { "name": "$user.name" } }`. A value is read from
 * the state (`$user.name`) or from the item of a repeated element (`$item.title`).
 */
export interface TemplateValue {
	readonly template: string;
	readonly values: Readonly<Record<string, string>>;
}

/** A thing the screen does, by name (`signIn`): the page says what it is (the address a form posts to). */
export interface ActionValue {
	readonly action: string;
}

/** What words a screen shows: exactly these shapes, nothing else. */
export type Words = TextValue | TemplateValue | StateValue | ItemValue;

export type SpecValue = string | number | boolean | StateValue | ItemValue | TextValue | TemplateValue | ActionValue;

/** Empty space in a container's children: between two children it is the space between them, first or last it is the container's inset on that end. */
export interface SpacingItem {
	readonly spacing: SpacingStep;
}

/** A child: another element by its id, empty space, or words. */
export type SpecChild = string | SpacingItem | Words;

/** Shown only when this holds: `{ state }` when the value is there (not empty, not false), `{ not }` the opposite. */
export type Visible = StateValue | ItemValue | { readonly not: Visible };

export interface SpecElement {
	readonly type: string;
	readonly props?: Readonly<Record<string, SpecValue>>;
	readonly children?: readonly SpecChild[];
	/** The part's named places (a page header's `title`, a row title's `address`), each filled with elements by id or words. */
	readonly slots?: Readonly<Record<string, readonly Exclude<SpecChild, SpacingItem>[]>>;
	readonly visible?: Visible;
	/** Drawn once for each item of this list (`{ "state": "/rows" }`); inside it, `{ "item": "/title" }` reads the item. */
	readonly repeat?: StateValue;
	/** The data a field holds and sends (`/form/email`): the name behavior wiring uses later. Only on entries the catalog lets bind. */
	readonly bind?: string;
}

export interface ScreenSpecDocument {
	readonly root: string;
	readonly elements: Readonly<Record<string, SpecElement>>;
}

const has = (key: string) => (value: unknown) => typeof value === "object" && value !== null && key in value;
export const isSpacing = (child: SpecChild): child is SpacingItem => has("spacing")(child);
export const isState = has("state") as (value: unknown) => value is StateValue;
export const isItem = has("item") as (value: unknown) => value is ItemValue;
export const isText = has("text") as (value: unknown) => value is TextValue;
export const isTemplate = has("template") as (value: unknown) => value is TemplateValue;
export const isAction = has("action") as (value: unknown) => value is ActionValue;
export const isWords = (value: unknown): value is Words =>
	isText(value) || isTemplate(value) || isState(value) || isItem(value);

/** A reference to another element of the spec by its id (`@emailInput`), for a label's field. */
export const refOf = (value: unknown): string | undefined =>
	typeof value === "string" && value.startsWith("@") ? value.slice(1) : undefined;

/** A template value (`$user.name`, `$item.title`) as what it reads. */
export function templateRead(value: string): StateValue | ItemValue | undefined {
	if (!value.startsWith("$")) return undefined;
	const [head, ...rest] = value.slice(1).split(".");
	return head === "item" ? { item: `/${rest.join("/")}` } : { state: `/${[head, ...rest].join("/")}` };
}
