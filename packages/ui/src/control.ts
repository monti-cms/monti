/**
 * The two sizes every text control shares (Input, Textarea, Select, Combobox), so a compact control in a toolbar or a table matches the 32px
 * buttons beside it and a form control matches the 36px ones. On a phone the default size writes 16px so the browser does not zoom in.
 */
export const CONTROL_SIZE = {
	sm: "h-8 text-monti-label md:text-monti-label",
	default: "h-9 text-monti-reading md:text-monti-body",
} as const;

export type ControlSize = keyof typeof CONTROL_SIZE;
