import type { StoredField } from "@monti-cms/core";
import type { ComponentType } from "react";

/** The entry a plugin's input or view is drawn in, as the editor holds it now: what is typed, saved or not. */
export type EntryView = {
	collection: string;
	locale: string | null;
	title: string;
	slug: string;
	/** Every field's value by its name. In a translation a field that is the same in every language holds the source's value. */
	values: Record<string, unknown>;
	/** The public address the entry has or would have; `null` without a slug or a public page. */
	address: string | null;
	/** Each field's name as the admin shows it. */
	labels: Record<string, string>;
	siteName: string;
};

/**
 * What an input a plugin brings is given (doc 14, a field's own input). It draws the input part alone, from the admin's parts
 * (`@monti-cms/ui`): the row and its label are the panel's. `id` goes on the control, so the label and a to-do row reach it.
 */
export type FieldInputProps = {
	id: string;
	field: string;
	definition: StoredField;
	/** The field's `inputOptions`, as the schema or the plugin gave them. */
	options: Record<string, unknown>;
	value: unknown;
	/** `null` empties the field. */
	onChange: (value: unknown) => void;
	readOnly: boolean;
	entry: EntryView;
};

/**
 * An input a plugin brings: the input part itself, or that with a `Note` drawn at the end of the field's label row (a character count).
 * Both are given the same props.
 */
export type FieldInput =
	| ComponentType<FieldInputProps>
	| { Input: ComponentType<FieldInputProps>; Note?: ComponentType<FieldInputProps> };

/** What a view field's component is given: it shows something of the entry and holds no value. */
export type FieldViewProps = {
	field: string;
	/** The view field's `options`, as the plugin gave them. */
	options: Record<string, unknown>;
	entry: EntryView;
};

/**
 * A plugin's half in the browser (doc 14): the components its server half names. It comes from a `"use client"` module and is handed to the
 * admin page (`<AdminPage plugins={[…]} />`), as a site's own blocks are.
 */
export type AdminPlugin = {
	/** The plugin's code name, as `definePlugin` has it. */
	name: string;
	/** Inputs by the name a field's `input` gives. */
	inputs?: Record<string, FieldInput>;
	/** Views by the name a view field's `view` gives. */
	views?: Record<string, ComponentType<FieldViewProps>>;
	/** The screens of its tool pages, by the page's id. */
	toolPages?: Record<string, ComponentType>;
};

export function defineAdminPlugin(plugin: AdminPlugin): AdminPlugin {
	return plugin;
}
