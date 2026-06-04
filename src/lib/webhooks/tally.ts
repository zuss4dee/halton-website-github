export type TallyField = {
  key?: string;
  label?: string;
  type?: string;
  value?: unknown;
};

export type TallyWebhookPayload = {
  eventId?: string;
  eventType?: string;
  createdAt?: string;
  data?: {
    fields?: TallyField[];
    formId?: string;
    formName?: string;
    responseId?: string;
    submissionId?: string;
  };
  fields?: TallyField[];
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function fieldLooksLikeEmail(field: TallyField): boolean {
  const type = field.type?.toUpperCase() ?? "";
  const label = field.label?.toLowerCase() ?? "";
  const key = field.key?.toLowerCase() ?? "";
  return (
    type.includes("EMAIL") ||
    label.includes("email") ||
    key.includes("email")
  );
}

export function extractTallyFields(payload: TallyWebhookPayload): TallyField[] {
  if (Array.isArray(payload.data?.fields)) return payload.data.fields;
  if (Array.isArray(payload.fields)) return payload.fields;
  return [];
}

export function extractEmailFromTallyPayload(payload: TallyWebhookPayload): string | null {
  const fields = extractTallyFields(payload);

  for (const field of fields) {
    if (!fieldLooksLikeEmail(field)) continue;
    const email = normalizeEmail(field.value);
    if (email) return email;
  }

  for (const field of fields) {
    const email = normalizeEmail(field.value);
    if (email) return email;
  }

  return null;
}

export function mapTallyFormData(payload: TallyWebhookPayload) {
  const fields = extractTallyFields(payload);

  return {
    source: "tally",
    receivedAt: new Date().toISOString(),
    eventId: payload.eventId ?? null,
    eventType: payload.eventType ?? null,
    createdAt: payload.createdAt ?? null,
    formId: payload.data?.formId ?? null,
    formName: payload.data?.formName ?? null,
    responseId: payload.data?.responseId ?? payload.data?.submissionId ?? null,
    fields: fields.map((field) => ({
      key: field.key ?? null,
      label: field.label ?? null,
      type: field.type ?? null,
      value: field.value ?? null,
    })),
    raw: payload,
  };
}
