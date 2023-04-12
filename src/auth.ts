import { encode, verify, VerifyResult } from "./jwt";

export const ValidateAccessToken = (token: string | undefined): { valid: boolean, reason?: string } => {
  let result: VerifyResult;

  try {
    result = verify(token, process.env.ACCESS_TOKEN_SECRET || "SECRET");
  } catch (e) {
    return { valid: false, reason: `Failed to parse token: ${e.message}` };
  }

  if (!result.sig) return { valid: false, reason: "Invalid signature" };

  return { valid: true };
};

const int = (s: string) => parseInt(s, 10);

export const CreateAccessToken = (username: string) => {
  const payload = {
    iat: Date.now(),
    sub: username,
    permissions: {},
  };

  return encode(payload, process.env.ACCESS_TOKEN_SECRET || "SECRET");
};
