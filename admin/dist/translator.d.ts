import type { MessageBundle, Translator } from "@monti-cms/core/client";
/** The translator of a message bundle (what `useTranslator(bundle)` returns), for helpers that receive `t` as a parameter. */
export type TranslatorFor<Bundle> = Bundle extends MessageBundle<infer K> ? Translator<K> : never;
