import { isAdultDob } from "@/lib/security/kyc";
import type { AccessGrant, DocumentBytes, DocumentMeta } from "@/lib/digilocker/contract";

const SIMULATED_ID = "00000000-0000-4000-8000-000000000001";
const SIMULATED_DOB = "1990-01-01";

export const MOCK_LICENCE_URI = "sim:licence";
export const MOCK_MARKSHEET_URI = "sim:marksheet";
export const MOCK_AUTH_CODE = "mock-auth-code";

type Variant = "ok" | "empty";

export function mockGrant(now: number, variant: Variant = "ok"): AccessGrant {
  return {
    accessToken: `mock.${now + 3_600_000}.${variant}`,
    expiresAt: now + 3_600_000,
    account: {
      digilockerId: SIMULATED_ID,
      name: "Simulated Citizen",
      adult: isAdultDob(SIMULATED_DOB, new Date(now)),
    },
  };
}

export function mockExchange(code: string, now = Date.now()): AccessGrant | "invalid_code" {
  if (code === "mock-empty-code") return mockGrant(now, "empty");
  if (code !== MOCK_AUTH_CODE) return "invalid_code";
  return mockGrant(now, "ok");
}

export function mockExpired(token: string, now = Date.now()): boolean {
  const match = token.match(/^mock\.(\d+)\.(ok|empty)$/);
  if (!match) return true;
  return Number(match[1]) <= now;
}

export function mockDocuments(token: string, now = Date.now()): DocumentMeta[] | "expired" | "unauthorized" {
  if (!token.startsWith("mock.")) return "unauthorized";
  if (mockExpired(token, now)) return "expired";
  if (token.endsWith(".empty")) return [];
  return [
    {
      uri: MOCK_LICENCE_URI,
      name: "Simulated driving licence",
      description: "SIMULATED — NOT A GOVERNMENT DOCUMENT",
      issuer: "Nagrek demo",
      mime: ["application/pdf"],
      date: "2020-01-15T00:00:00Z",
      downloadable: true,
      simulated: true,
    },
    {
      uri: MOCK_MARKSHEET_URI,
      name: "Simulated Class XII marksheet",
      description: "SIMULATED — NOT A GOVERNMENT DOCUMENT",
      issuer: "Nagrek demo",
      mime: ["application/xml"],
      date: "2018-05-12T00:00:00Z",
      downloadable: true,
      simulated: true,
    },
  ];
}

export function mockDocument(token: string, uri: string, format: "pdf" | "xml", now = Date.now()): DocumentBytes | "expired" | "not_found" | "unauthorized" {
  const list = mockDocuments(token, now);
  if (list === "expired" || list === "unauthorized") return list;
  const known = list.find((item) => item.uri === uri);
  if (!known) return "not_found";
  if (format === "xml" || uri === MOCK_MARKSHEET_URI) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SimulatedDocument notice="SIMULATED — NOT A GOVERNMENT DOCUMENT">
  <name>Simulated Class XII Marksheet</name>
  <holder>Simulated Citizen</holder>
</SimulatedDocument>
`;
    return { body: Buffer.from(xml), contentType: "application/xml", filename: "simulated-marksheet.xml", simulated: true };
  }
  return { body: simulatedPdf(), contentType: "application/pdf", filename: "simulated-licence.pdf", simulated: true };
}

function simulatedPdf(): Buffer {
  const text = "SIMULATED - NOT A GOVERNMENT DOCUMENT";
  return Buffer.from(
    `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${text.length + 36} >> stream
BT /F1 18 Tf 72 720 Td (${text}) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`,
  );
}
