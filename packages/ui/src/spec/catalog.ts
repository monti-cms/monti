import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import type { ComponentProps } from "react";
import { z } from "zod";
import type { Button } from "../button";
import { LAYOUT } from "../layout";
import type { Heading, Text } from "../text";
import { GAP } from "../tokens.generated";

/**
 * The parts a screen spec may use, with their props as zod schemas. A spec is JSON an agent writes; the renderer draws it with the real
 * `@monti-cms/ui` parts (`registry.tsx`), so a spec cannot reach outside the design system: an unknown part or prop value fails the schema.
 * Option lists come from the parts' own tables (`GAP`, `LAYOUT`) where the part keeps one; the type checks at the end of this file keep the
 * hand-written lists equal to the parts' prop types.
 */

/** The keys of a part's option table as a zod schema (numeric keys such as a gap of `32` stay numbers). */
function keysOf<T extends object>(table: T): z.ZodType<Extract<keyof T, string | number>> {
	const keys = Object.keys(table).map((key) => (/^\d+$/.test(key) ? Number(key) : key));
	return z.union(
		keys.map((key) => z.literal(key)) as [z.ZodLiteral<string | number>, ...z.ZodLiteral<string | number>[]],
	) as never;
}

const TEXT_VARIANT = [
	"micro",
	"meta",
	"caption",
	"note",
	"label",
	"body",
	"title",
	"reading",
	"heading",
	"page",
	"display",
] as const;
const TEXT_TONE = [
	"default",
	"muted",
	"subtle",
	"faint",
	"proposal",
	"danger",
	"warning",
	"success",
	"inherit",
] as const;
const HEADING_VARIANT = ["label", "title", "page", "heading", "display"] as const;
const BUTTON_VARIANT = ["primary", "secondary", "danger", "outline-danger"] as const;

/** A text the part shows: plain, or read from the state (`{ "$state": "/text/signInSubmit" }`), so a spec carries no copy of its own. */
const text = z.string();

/** The parts and their props; `screenCatalog` hands them to json-render, `checkSpec` checks a spec's props against them. */
const components = {
	Stack: {
		props: z.object({
			gap: keysOf(GAP).optional(),
			align: z.enum(["start", "center", "end", "baseline", "stretch"]).optional(),
			justify: z.enum(["start", "center", "end", "between"]).optional(),
			grow: z.boolean().optional(),
			minHeight: keysOf(LAYOUT.minHeight).optional(),
			paddingTop: keysOf(LAYOUT.paddingTop).optional(),
			paddingBottom: keysOf(LAYOUT.paddingBottom).optional(),
			paddingX: keysOf(LAYOUT.paddingX).optional(),
			background: keysOf(LAYOUT.background).optional(),
		}),
		description: "A column of children with a gap from the spacing scale.",
	},
	Box: {
		props: z.object({
			width: keysOf(LAYOUT.width).optional(),
			maxWidth: keysOf(LAYOUT.maxWidth).optional(),
			border: keysOf(LAYOUT.border).optional(),
		}),
		description: "A box with layout options only; `border: bottom-contrast` is the ink rule under a title.",
	},
	Heading: {
		props: z.object({ as: z.enum(["h1", "h2", "h3", "h4"]).optional(), variant: z.enum(HEADING_VARIANT), text }),
		description: "A heading; `page` is the title of a screen.",
	},
	Text: {
		props: z.object({
			as: z.enum(["p", "span"]).optional(),
			variant: z.enum(TEXT_VARIANT),
			tone: z.enum(TEXT_TONE).optional(),
			align: z.enum(["start", "center", "end"]).optional(),
			text,
		}),
		description: "A run of text in a type role.",
	},
	Form: {
		props: z.object({ method: z.enum(["post", "get"]), action: z.string() }),
		description: "A plain HTML form; `action` is the address it posts to, read from the state.",
	},
	FormField: { props: z.object({}), description: "A labeled field: label, control, at most one line of error." },
	FormFieldLabel: {
		props: z.object({ htmlFor: z.string(), text }),
		description: "The label above a field (mono 11).",
	},
	Input: {
		props: z.object({
			id: z.string(),
			name: z.string(),
			type: z.enum(["text", "email", "password"]),
			autoComplete: z.enum(["username", "current-password", "new-password", "off"]).optional(),
			required: z.boolean().optional(),
			minLength: z.number().int().nonnegative().optional(),
			placeholder: z.string().optional(),
			/** What the field holds when the screen opens (a sample screen shows a filled form). */
			defaultValue: z.string().optional(),
			invalid: z.boolean().optional(),
		}),
		description: "A one-line field drawn as an underline; `invalid` turns the line red and points at `<id>-error`.",
	},
	FormFieldError: {
		props: z.object({ id: z.string().optional(), text }),
		description: "One red line under a field, or under a form for an error of the whole form.",
	},
	Button: {
		props: z.object({
			type: z.enum(["submit", "button"]),
			variant: z.enum(BUTTON_VARIANT),
			width: z.literal("full").optional(),
			disabled: z.boolean().optional(),
			icon: z.string().optional(),
			text,
		}),
		description: "A pill; one `primary` per screen.",
	},
	Separator: {
		props: z.object({ label: z.string() }),
		description: "A horizontal rule with a word in its middle (between two ways to sign in).",
	},
	TextButton: {
		props: z.object({ type: z.enum(["submit", "button"]), text }),
		description: "A quiet text button.",
	},
} satisfies Record<string, { props: z.ZodObject; description: string }>;

export const screenCatalog = defineCatalog(schema, { components, actions: {} });

/** A value the renderer works out from the state (`$state`, `$item`, `$cond`, …) rather than one written in the spec. */
const isExpression = (value: unknown) =>
	typeof value === "object" && value !== null && Object.keys(value).some((key) => key.startsWith("$"));

/**
 * Checks a spec against the catalog: every element is a catalog part (json-render's own `validate`), it takes no prop its part does not
 * have, and every prop written as a value passes the part's schema (a button variant, a gap on the spacing scale). A prop read from the state
 * is checked when it is drawn (`registry.tsx`). Returns one line per problem; none means the spec stays inside the design system.
 */
export function checkSpec(spec: unknown): string[] {
	const shape = screenCatalog.validate(spec);
	if (!shape.success) return (shape.error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
	const problems: string[] = [];
	const { elements } = spec as {
		elements: Record<string, { type: keyof typeof components; props?: Record<string, unknown> }>;
	};
	for (const [id, element] of Object.entries(elements)) {
		const props = components[element.type].props;
		const written = Object.fromEntries(Object.entries(element.props ?? {}).filter(([, value]) => !isExpression(value)));
		for (const key of Object.keys(element.props ?? {})) {
			if (!(key in props.shape)) problems.push(`${id}: ${element.type} has no prop "${key}"`);
		}
		const result = props.partial().safeParse(written);
		if (!result.success) {
			for (const issue of result.error.issues) problems.push(`${id}.${issue.path.join(".")}: ${issue.message}`);
		}
	}
	return problems;
}

/** Checks the props an element is drawn with, after the state is read into them; the same schema as `checkSpec`. */
export function checkDrawnProps(type: string, props: unknown): string[] {
	const part = components[type as keyof typeof components];
	if (!part) return [`${type}: not a catalog part`];
	const result = part.props.strict().safeParse(props);
	return result.success ? [] : result.error.issues.map((issue) => `${type}.${issue.path.join(".")}: ${issue.message}`);
}

// The hand-written lists must equal the parts' prop types: when a part gains or drops a value, these lines stop compiling.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Check<T extends true> = T;
export type CatalogMatchesParts = [
	Check<Same<(typeof TEXT_VARIANT)[number], NonNullable<ComponentProps<typeof Text>["variant"]>>>,
	Check<Same<(typeof TEXT_TONE)[number], NonNullable<ComponentProps<typeof Text>["tone"]>>>,
	Check<Same<(typeof HEADING_VARIANT)[number], NonNullable<ComponentProps<typeof Heading>["variant"]>>>,
	Check<Same<(typeof BUTTON_VARIANT)[number], NonNullable<ComponentProps<typeof Button>["variant"]>>>,
];
