/** Real post bodies for regression tests. Only posts with varied syntax were picked from the earlier file-based posts. */
export declare const SAMPLES_DIR: string;
export declare const readSample: (name: string) => string;
/** All sample posts. `mdx` is the body with the front matter removed (the shape stored in the DB). */
export declare const readSamples: () => {
    name: string;
    mdx: string;
}[];
