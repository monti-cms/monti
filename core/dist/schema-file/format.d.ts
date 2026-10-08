import { z } from "zod";
import type { SchemaFile } from "./types.js";
/** The schema file. Exported for the JSON Schema build; use `parseSchemaFile` to read one. */
export declare const schemaFileShape: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodOptional<z.ZodNumber>;
    collections: z.ZodRecord<z.ZodString, z.ZodObject<{
        label: z.ZodString;
        kind: z.ZodEnum<{
            document: "document";
            item: "item";
        }>;
        body: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodObject<{
            blocks: z.ZodOptional<z.ZodArray<z.ZodString>>;
            marks: z.ZodOptional<z.ZodArray<z.ZodString>>;
            headings: z.ZodOptional<z.ZodArray<z.ZodLiteral<1 | 2 | 3 | 4 | 5 | 6>>>;
        }, z.core.$strict>]>>;
        fields: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodLiteral<true>>;
            localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            kind: z.ZodLiteral<"text">;
            fillFromBody: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodObject<{
                maxLength: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>]>>;
            multiline: z.ZodOptional<z.ZodBoolean>;
            rows: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>, z.ZodObject<{
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodLiteral<true>>;
            localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            kind: z.ZodLiteral<"slug">;
            from: z.ZodOptional<z.ZodString>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>, z.ZodObject<{
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodLiteral<true>>;
            localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            kind: z.ZodLiteral<"relation">;
            to: z.ZodString;
            many: z.ZodOptional<z.ZodBoolean>;
            createInline: z.ZodOptional<z.ZodBoolean>;
            publishedOnly: z.ZodOptional<z.ZodBoolean>;
            allowUnpublished: z.ZodOptional<z.ZodBoolean>;
            ordered: z.ZodOptional<z.ZodBoolean>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>, z.ZodObject<{
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodLiteral<true>>;
            localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            kind: z.ZodLiteral<"select">;
            options: z.ZodRecord<z.ZodString, z.ZodString>;
            defaultValue: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodLiteral<true>>;
            localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            kind: z.ZodLiteral<"media">;
            accept: z.ZodOptional<z.ZodEnum<{
                file: "file";
                image: "image";
            }>>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"conditional">;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            discriminant: z.ZodObject<{
                label: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                required: z.ZodOptional<z.ZodLiteral<true>>;
                localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
                input: z.ZodOptional<z.ZodString>;
                inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
                hidden: z.ZodOptional<z.ZodBoolean>;
                role: z.ZodOptional<z.ZodString>;
                tab: z.ZodOptional<z.ZodString>;
                kind: z.ZodLiteral<"select">;
                options: z.ZodRecord<z.ZodString, z.ZodString>;
                defaultValue: z.ZodString;
            }, z.core.$strict>;
            values: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
                label: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                required: z.ZodOptional<z.ZodLiteral<true>>;
                localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
                input: z.ZodOptional<z.ZodString>;
                inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
                hidden: z.ZodOptional<z.ZodBoolean>;
                role: z.ZodOptional<z.ZodString>;
                tab: z.ZodOptional<z.ZodString>;
                kind: z.ZodLiteral<"text">;
                fillFromBody: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodObject<{
                    maxLength: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>]>>;
                multiline: z.ZodOptional<z.ZodBoolean>;
                rows: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                placeholder: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>, z.ZodObject<{
                label: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                required: z.ZodOptional<z.ZodLiteral<true>>;
                localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
                input: z.ZodOptional<z.ZodString>;
                inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
                hidden: z.ZodOptional<z.ZodBoolean>;
                role: z.ZodOptional<z.ZodString>;
                tab: z.ZodOptional<z.ZodString>;
                kind: z.ZodLiteral<"relation">;
                to: z.ZodString;
                many: z.ZodOptional<z.ZodBoolean>;
                createInline: z.ZodOptional<z.ZodBoolean>;
                publishedOnly: z.ZodOptional<z.ZodBoolean>;
                allowUnpublished: z.ZodOptional<z.ZodBoolean>;
                ordered: z.ZodOptional<z.ZodBoolean>;
                placeholder: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>, z.ZodObject<{
                label: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                required: z.ZodOptional<z.ZodLiteral<true>>;
                localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
                input: z.ZodOptional<z.ZodString>;
                inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
                hidden: z.ZodOptional<z.ZodBoolean>;
                role: z.ZodOptional<z.ZodString>;
                tab: z.ZodOptional<z.ZodString>;
                kind: z.ZodLiteral<"select">;
                options: z.ZodRecord<z.ZodString, z.ZodString>;
                defaultValue: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                label: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                required: z.ZodOptional<z.ZodLiteral<true>>;
                localized: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"inherit">]>>;
                input: z.ZodOptional<z.ZodString>;
                inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
                hidden: z.ZodOptional<z.ZodBoolean>;
                role: z.ZodOptional<z.ZodString>;
                tab: z.ZodOptional<z.ZodString>;
                kind: z.ZodLiteral<"media">;
                accept: z.ZodOptional<z.ZodEnum<{
                    file: "file";
                    image: "image";
                }>>;
                placeholder: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "kind">>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"backlink">;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            input: z.ZodOptional<z.ZodString>;
            inputOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            role: z.ZodOptional<z.ZodString>;
            tab: z.ZodOptional<z.ZodString>;
            from: z.ZodString;
            via: z.ZodString;
            createInline: z.ZodOptional<z.ZodBoolean>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"view">;
            view: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            tab: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>], "kind">>;
        path: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        layout: z.ZodOptional<z.ZodArray<z.ZodObject<{
            group: z.ZodOptional<z.ZodString>;
            fields: z.ZodArray<z.ZodString>;
            collapsed: z.ZodOptional<z.ZodBoolean>;
            tab: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
        list: z.ZodOptional<z.ZodObject<{
            columns: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    migrations: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
        collection: z.ZodString;
        op: z.ZodLiteral<"renameField">;
        from: z.ZodString;
        to: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
        collection: z.ZodString;
        op: z.ZodLiteral<"mapOption">;
        field: z.ZodString;
        from: z.ZodString;
        to: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
        collection: z.ZodString;
        op: z.ZodLiteral<"dropField">;
        field: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
        collection: z.ZodString;
        op: z.ZodLiteral<"setDefault">;
        field: z.ZodString;
        value: z.ZodString;
    }, z.core.$strict>], "op">>>;
    locales: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    defaultLocale: z.ZodString;
    timeZone: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
        name: z.ZodOptional<z.ZodString>;
        previewPath: z.ZodOptional<z.ZodString>;
        previewLocaleParam: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<false>]>>;
        localePrefix: z.ZodOptional<z.ZodEnum<{
            [x: string]: string;
        }>>;
        home: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    admin: z.ZodOptional<z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        messages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>>;
        templates: z.ZodOptional<z.ZodBoolean>;
        translations: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    seed: z.ZodOptional<z.ZodObject<{
        templates: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            doc: z.ZodObject<{
                type: z.ZodLiteral<"doc">;
                version: z.ZodNumber;
                content: z.ZodArray<z.ZodUnknown>;
            }, z.core.$loose>;
        }, z.core.$strict>, z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            body: z.ZodString;
            format: z.ZodString;
        }, z.core.$strict>]>>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
/** A problem in a schema file, with the JSON path of the value. */
export interface SchemaIssue {
    /** Path from the root, e.g. `collections.post.fields.title.kind` or `locales[1].code`. Empty for the root. */
    readonly path: string;
    readonly message: string;
}
/** A schema file that is not valid. `message` lists every problem with its JSON path. */
export declare class SchemaFileError extends Error {
    readonly issues: readonly SchemaIssue[];
    readonly source: string;
    constructor(source: string, issues: readonly SchemaIssue[]);
}
/**
 * Checks a schema file's content (already parsed from JSON) and returns a copy of it. Throws a {@link SchemaFileError} naming the JSON path of every problem.
 * `source` is what error messages call the file (its path).
 */
export declare function parseSchemaFile(input: unknown, source?: string): SchemaFile;
