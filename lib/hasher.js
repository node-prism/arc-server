import crypto from "crypto";
export class Hasher {
    algorithm;
    saltLength;
    constructor(algorithm = "sha256", saltLength = 64) {
        this.algorithm = algorithm;
        this.saltLength = saltLength;
    }
    verify(encoded, unencoded) {
        const { algorithm, salt } = this.parse(encoded);
        return this.hash(unencoded, algorithm, salt) === encoded;
    }
    encode(string) {
        const salt = crypto.randomBytes(this.saltLength).toString("base64");
        return this.hash(string, this.algorithm, salt);
    }
    hash(string, algorithm, salt) {
        const hash = crypto.createHash(algorithm);
        hash.update(string);
        hash.update(salt, "utf8");
        return `${algorithm}:${salt}:${hash.digest("base64")}`;
    }
    parse(encoded) {
        const parts = encoded.split(":");
        if (parts.length !== 3) {
            throw new Error(`Invalid hash string. Expected 3 parts, got ${parts.length}`);
        }
        const algorithm = parts[0];
        const salt = parts[1];
        const digest = parts[2];
        return {
            algorithm,
            salt,
            digest,
        };
    }
}
export const hash = new Hasher();
