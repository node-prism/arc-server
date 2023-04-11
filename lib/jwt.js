import crypto from "node:crypto";
import { derToJose, joseToDer } from "ecdsa-sig-formatter";
const algorithms = [
    "HS256",
    "HS384",
    "HS512",
    "RS256",
    "RS384",
    "RS512",
];
function isValidAlgorithm(alg) {
    return algorithms.includes(alg);
}
const Algorithms = {
    HS256: createHmac(256),
    HS384: createHmac(384),
    HS512: createHmac(512),
    RS256: createSign(256),
    RS384: createSign(384),
    RS512: createSign(512),
    ES256: createEcdsa(256),
};
function createHmac(bits) {
    function sign(encoded, secret) {
        return crypto
            .createHmac(`sha${bits}`, secret)
            .update(encoded)
            .digest("base64");
    }
    function verify(encoded, signature, secret) {
        return sign(encoded, secret) === signature;
    }
    return { sign, verify };
}
function createSign(bits) {
    const algorithm = `RSA-SHA${bits}`;
    function sign(encoded, secret) {
        return crypto
            .createSign(algorithm)
            .update(encoded)
            .sign(secret.toString(), "base64");
    }
    function verify(encoded, signature, secret) {
        const v = crypto.createVerify(algorithm);
        v.update(encoded);
        return v.verify(secret, signature, "base64");
    }
    return { sign, verify };
}
function createEcdsa(bits) {
    const algorithm = `RSA-SHA${bits}`;
    function sign(encoded, secret) {
        const sig = crypto
            .createSign(algorithm)
            .update(encoded)
            .sign({ key: secret.toString() }, "base64");
        return derToJose(sig, `ES${bits}`);
    }
    function verify(encoded, signature, secret) {
        signature = joseToDer(signature, `ES${bits}`).toString("base64");
        const v = crypto.createVerify(algorithm);
        v.update(encoded);
        return v.verify(secret, signature, "base64");
    }
    return { sign, verify };
}
function encodeJSONBase64(obj) {
    const j = JSON.stringify(obj);
    return Base64ToURLEncoded(Buffer.from(j).toString("base64"));
}
/**
 * TODO:
 * If what's decoded isn't valid JSON, then parse throws and crashes
 * the server.
 */
function decodeJSONBase64(str) {
    const dec = Buffer.from(URLEncodedToBase64(str), "base64").toString("utf-8");
    return JSON.parse(dec);
}
function Base64ToURLEncoded(b64) {
    return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function URLEncodedToBase64(enc) {
    enc = enc.toString();
    const pad = 4 - (enc.length % 4);
    if (pad !== 4) {
        for (let i = 0; i < pad; i++) {
            enc += "=";
        }
    }
    return enc.replace(/-/g, "+").replace(/_/g, "/");
}
function encode(payload, key, alg = "HS256") {
    if (!isValidAlgorithm(alg)) {
        throw new Error(`${alg} is an invalid algorithm type. Must be one of ${algorithms}`);
    }
    const b64header = encodeJSONBase64({ alg, type: "JWT" });
    const b64payload = encodeJSONBase64(payload);
    const unsigned = `${b64header}.${b64payload}`;
    const signer = Algorithms[alg];
    const sig = Base64ToURLEncoded(signer.sign(unsigned, key));
    return `${unsigned}.${sig}`;
}
function decode(encoded) {
    const parts = encoded.split(".");
    if (parts.length !== 3) {
        throw new Error(`Decode expected 3 parts to encoded token, got ${parts.length}`);
    }
    const header = decodeJSONBase64(parts[0]);
    const payload = decodeJSONBase64(parts[1]);
    const signature = Buffer.from(URLEncodedToBase64(parts[2]), "base64");
    return { header, payload, signature };
}
function verify(encoded, key, opts = {}) {
    const decoded = decode(encoded);
    const { payload } = decoded;
    const parts = encoded.split(".");
    const alg = opts.alg ?? decoded.header.alg;
    const now = Date.now();
    const verifier = Algorithms[alg];
    const result = { decoded };
    if (opts.sig === undefined || opts.sig === true) {
        result.sig = verifier.verify(`${parts[0]}.${parts[1]}`, URLEncodedToBase64(parts[2]), key);
    }
    if (payload.exp !== undefined) {
        result.exp = payload.exp < now;
    }
    if (payload.nbf !== undefined) {
        result.nbf = now >= payload.nbf;
    }
    if (opts.iat !== undefined) {
        result.iat = payload.iat === opts.iat;
    }
    if (opts.iss !== undefined) {
        result.iss = payload.iss === opts.iss;
    }
    if (opts.jti !== undefined) {
        result.jti = payload.jti !== opts.jti;
    }
    if (opts.sub !== undefined) {
        result.sub = payload.sub === opts.sub;
    }
    if (opts.aud !== undefined) {
        result.aud = payload.aud === opts.aud;
    }
    return result;
}
export { encode, decode, verify, };
