/**
 * How long a model list asked of the keys' services anew serves before a model menu asks them again. A service's models change without the
 * key changing (OpenRouter's free ones, weekly), and the server asks only once a day by itself: opening a model menu asks now (doc 10).
 */
export const MODELS_ASK_AGAIN_MS = 5 * 60_000;
