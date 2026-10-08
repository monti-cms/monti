/** The sha git gives a blob with this text (`sha1("blob <bytes>\0" + content)`): what GitHub returns for a file with exactly this text, so no call is needed to know it. */
export declare const blobSha: (text: string) => string;
