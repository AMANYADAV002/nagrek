export type DigiLockerMode = "mock" | "official";

/** Account fields the browser may see. The date of birth is not included. */
export type Account = {
  digilockerId: string;
  name: string;
  adult: boolean | null;
};

export type DocumentMeta = {
  uri: string;
  name: string;
  description: string;
  issuer: string;
  mime: string[];
  date: string;
  downloadable: boolean;
  simulated: boolean;
};

export type DocumentBytes = {
  body: Buffer;
  contentType: string;
  filename: string;
  simulated: boolean;
};

export type AccessGrant = {
  accessToken: string;
  expiresAt: number;
  account: Account;
};

export type DigiLockerFailure =
  | "denied"
  | "invalid_code"
  | "invalid_state"
  | "expired"
  | "not_found"
  | "unauthorized"
  | "unavailable"
  | "aadhaar_blocked"
  | "unconfigured"
  | "backend";
