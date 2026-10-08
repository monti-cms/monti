const FORMAT_NAME = /^[a-z][a-z0-9-]*$/;
export function assertFormatName(name) {
    if (!FORMAT_NAME.test(name))
        throw new Error(`cms format: invalid name "${name}"`);
}
/** Declares a format. It returns the value as it is, so the literal type of `name` is kept. */
export const defineFormat = (format) => {
    assertFormatName(format.name);
    return format;
};
