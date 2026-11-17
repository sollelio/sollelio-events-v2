import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessInquiries,
  inquiryErrorKey,
  isCloseReason,
  parseEventDate,
  parseInquiryForm,
  snippet,
  submitInquiry,
  zonedLocalToUtc,
  type CreateInquiryArgs,
  type RpcResult,
} from "./inquiry.ts";

const NOW = new Date("2026-11-17T12:00:00Z");
const REQUEST_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ORG = "0a000000-0000-4000-8000-00000000000a";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("zonedLocalToUtc", () => {
  it("converts wall-clock times to UTC instants", () => {
    const cases: [string, string, string][] = [
      ["2026-01-15T10:00", "Europe/Lisbon", "2026-01-15T10:00:00.000Z"],
      ["2026-07-15T10:00", "Europe/Lisbon", "2026-07-15T09:00:00.000Z"],
      ["2026-07-15T10:00", "Africa/Luanda", "2026-07-15T09:00:00.000Z"],
      ["2026-07-15T10:00", "America/Sao_Paulo", "2026-07-15T13:00:00.000Z"],
      ["2026-07-15T10:00", "UTC", "2026-07-15T10:00:00.000Z"],
    ];
    for (const [local, zone, expected] of cases) {
      assert.equal(zonedLocalToUtc(local, zone)?.toISOString(), expected);
    }
  });

  it("resolves DST edges deterministically", () => {
    // Lisbon, 29 Mar 2026: 01:00 → 02:00 (01:30 does not exist).
    assert.equal(
      zonedLocalToUtc("2026-03-29T01:30", "Europe/Lisbon")?.toISOString(),
      "2026-03-29T01:30:00.000Z",
    );
    // Lisbon, 25 Oct 2026: 02:00 → 01:00 (01:30 happens twice).
    assert.equal(
      zonedLocalToUtc("2026-10-25T01:30", "Europe/Lisbon")?.toISOString(),
      "2026-10-25T01:30:00.000Z",
    );
  });

  it("rejects impossible dates and unknown zones", () => {
    assert.equal(zonedLocalToUtc("2026-02-30T10:00", "UTC"), undefined);
    assert.equal(zonedLocalToUtc("2026-01-15T24:00", "UTC"), undefined);
    assert.equal(zonedLocalToUtc("2026-01-15 10:00", "UTC"), undefined);
    assert.equal(
      zonedLocalToUtc("2026-01-15T10:00", "Mars/Olympus"),
      undefined,
    );
  });
});

describe("parseEventDate", () => {
  it("accepts real dates between 2000 and 2100 only", () => {
    assert.equal(parseEventDate("2027-06-12"), "2027-06-12");
    assert.equal(parseEventDate("2028-02-29"), "2028-02-29");
    assert.equal(parseEventDate("2027-02-29"), undefined);
    assert.equal(parseEventDate("1999-12-31"), undefined);
    assert.equal(parseEventDate("12/06/2027"), undefined);
  });
});

describe("parseInquiryForm", () => {
  it("accepts a verbatim message alone and keeps it as written", () => {
    const parsed = parseInquiryForm(
      form({
        source: "whatsapp",
        clientMessage: "\n  Olá!\n\nQueria um orçamento.  \n",
        requestId: REQUEST_ID,
      }),
      NOW,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.args.p_client_message, "Olá!\n\nQueria um orçamento.");
    assert.equal(parsed.args.p_staff_summary, null);
    assert.equal(
      parsed.args.p_received_at,
      null,
      "now is stamped by the database",
    );
  });

  it("accepts a staff summary alone; every other field may be missing", () => {
    const parsed = parseInquiryForm(
      form({ source: "phone", staffSummary: "Ligou a pedir datas." }),
      NOW,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.args, {
      p_source: "phone",
      p_client_message: null,
      p_staff_summary: "Ligou a pedir datas.",
      p_received_at: null,
      p_requester_name: null,
      p_requester_phone: null,
      p_requester_email: null,
      p_requested_event_date: null,
      p_estimated_guests: null,
    });
  });

  it("requires a source and at least one form of description", () => {
    const parsed = parseInquiryForm(
      form({ clientMessage: "   \n ", staffSummary: "" }),
      NOW,
    );
    assert.equal(parsed.ok, false);
    assert.deepEqual(!parsed.ok && parsed.fieldErrors, {
      source: "sourceRequired",
      description: "descriptionRequired",
    });
  });

  it("rejects unknown sources", () => {
    const parsed = parseInquiryForm(
      form({ source: "fax", clientMessage: "x" }),
      NOW,
    );
    assert.deepEqual(!parsed.ok && parsed.fieldErrors, {
      source: "sourceRequired",
    });
  });

  it("limits description lengths like the database", () => {
    const parsed = parseInquiryForm(
      form({
        source: "email",
        clientMessage: "x".repeat(10001),
        staffSummary: "y".repeat(5001),
      }),
      NOW,
    );
    assert.deepEqual(!parsed.ok && parsed.fieldErrors, {
      clientMessage: "clientMessageTooLong",
      staffSummary: "staffSummaryTooLong",
    });
  });

  it("converts another receipt time in the device's time zone to UTC", () => {
    const parsed = parseInquiryForm(
      form({
        source: "phone",
        staffSummary: "x",
        receivedMode: "other",
        receivedLocal: "2026-11-16T18:45",
        timeZone: "Africa/Luanda",
      }),
      NOW,
    );
    assert.equal(
      parsed.ok && parsed.args.p_received_at,
      "2026-11-16T17:45:00.000Z",
    );
  });

  it("rejects receipt times that are missing, impossible, early or in the future", () => {
    const base = { source: "phone", staffSummary: "x", receivedMode: "other" };
    const errorFor = (fields: Record<string, string>) => {
      const parsed = parseInquiryForm(form({ ...base, ...fields }), NOW);
      return !parsed.ok ? parsed.fieldErrors.received : undefined;
    };
    assert.equal(errorFor({ timeZone: "UTC" }), "receivedRequired");
    assert.equal(
      errorFor({ receivedLocal: "2026-11-16T18:45" }),
      "receivedTimeZoneMissing",
    );
    assert.equal(
      errorFor({ receivedLocal: "2026-13-01T10:00", timeZone: "UTC" }),
      "receivedInvalid",
    );
    assert.equal(
      errorFor({ receivedLocal: "1999-12-31T10:00", timeZone: "UTC" }),
      "receivedInvalid",
    );
    assert.equal(
      errorFor({ receivedLocal: "2026-11-17T13:00", timeZone: "UTC" }),
      "receivedInFuture",
    );
    assert.equal(
      errorFor({ receivedLocal: "2026-11-17T12:04", timeZone: "UTC" }),
      undefined,
      "small clock differences are tolerated",
    );
  });

  it("keeps requester details as given, trimmed, and checks their shape", () => {
    const ok = parseInquiryForm(
      form({
        source: "email",
        clientMessage: "x",
        requesterName: "  Ana Marques ",
        requesterPhone: " +351 912 345 678 ",
        requesterEmail: " Ana@Example.test ",
      }),
      NOW,
    );
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.args.p_requester_name, "Ana Marques");
      assert.equal(ok.args.p_requester_phone, "+351 912 345 678");
      assert.equal(ok.args.p_requester_email, "Ana@Example.test");
    }
    const bad = parseInquiryForm(
      form({
        source: "email",
        clientMessage: "x",
        requesterName: "a".repeat(201),
        requesterPhone: "sem número",
        requesterEmail: "ana@",
      }),
      NOW,
    );
    assert.deepEqual(!bad.ok && bad.fieldErrors, {
      requesterName: "nameTooLong",
      requesterPhone: "phoneInvalid",
      requesterEmail: "emailInvalid",
    });
  });

  it("checks the optional event date and guest estimate", () => {
    const ok = parseInquiryForm(
      form({
        source: "email",
        clientMessage: "x",
        eventDate: "2027-06-12",
        guests: "120",
      }),
      NOW,
    );
    assert.equal(ok.ok && ok.args.p_requested_event_date, "2027-06-12");
    assert.equal(ok.ok && ok.args.p_estimated_guests, 120);
    for (const guests of ["0", "-1", "1.5", "abc", "100001"]) {
      const bad = parseInquiryForm(
        form({ source: "email", clientMessage: "x", guests }),
        NOW,
      );
      assert.equal(!bad.ok && bad.fieldErrors.guests, "guestsInvalid", guests);
    }
    const badDate = parseInquiryForm(
      form({ source: "email", clientMessage: "x", eventDate: "2027-02-30" }),
      NOW,
    );
    assert.equal(
      !badDate.ok && badDate.fieldErrors.eventDate,
      "eventDateInvalid",
    );
  });
});

describe("submitInquiry", () => {
  function fakeDatabase() {
    const byRequest = new Map<string, CreateInquiryArgs>();
    const calls: CreateInquiryArgs[] = [];
    let ids = 0;
    return {
      calls,
      byRequest,
      async createInquiry(args: CreateInquiryArgs): Promise<RpcResult<string>> {
        calls.push(args);
        const existing = byRequest.get(args.p_request_id);
        if (!existing) {
          byRequest.set(args.p_request_id, args);
          return { ok: true, data: `inquiry-${args.p_request_id}` };
        }
        return JSON.stringify({ ...existing, p_received_at: null }) ===
          JSON.stringify({ ...args, p_received_at: null })
          ? { ok: true, data: `inquiry-${args.p_request_id}` }
          : { ok: false, code: "23505" };
      },
      newRequestId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
    };
  }

  const valid = () =>
    form({ source: "whatsapp", clientMessage: "Olá", requestId: REQUEST_ID });

  it("registers in the server-resolved organization, never one from the form", async () => {
    const db = fakeDatabase();
    const data = valid();
    data.set("organizationId", "99999999-9999-4999-8999-999999999999");
    data.set("createdBy", "someone-else");
    const outcome = await submitInquiry(data, {
      organizationId: ORG,
      now: NOW,
      ...db,
    });
    assert.deepEqual(outcome, {
      kind: "created",
      inquiryId: `inquiry-${REQUEST_ID}`,
    });
    assert.equal(db.calls[0]?.p_organization_id, ORG);
    assert.deepEqual(Object.keys(db.calls[0] ?? {}).sort(), [
      "p_client_message",
      "p_estimated_guests",
      "p_organization_id",
      "p_received_at",
      "p_request_id",
      "p_requested_event_date",
      "p_requester_email",
      "p_requester_name",
      "p_requester_phone",
      "p_source",
      "p_staff_summary",
    ]);
  });

  it("does not call the database when validation fails, and keeps the values", async () => {
    const db = fakeDatabase();
    const outcome = await submitInquiry(
      form({ source: "phone", requesterName: "Ana", requestId: REQUEST_ID }),
      { organizationId: ORG, now: NOW, ...db },
    );
    assert.equal(db.calls.length, 0);
    assert.equal(outcome.kind, "form");
    if (outcome.kind !== "form") return;
    assert.equal(outcome.state.requestId, REQUEST_ID);
    assert.equal(outcome.state.values.requesterName, "Ana");
    assert.deepEqual(outcome.state.fieldErrors, {
      description: "descriptionRequired",
    });
  });

  it("does not submit without a valid request id", async () => {
    const db = fakeDatabase();
    const outcome = await submitInquiry(
      form({ source: "phone", staffSummary: "x", requestId: "forged" }),
      { organizationId: ORG, now: NOW, ...db },
    );
    assert.equal(db.calls.length, 0);
    assert.equal(outcome.kind === "form" && outcome.state.formError, "generic");
  });

  it("keeps the request id after a network failure, so the retry is idempotent", async () => {
    const db = fakeDatabase();
    const real = db.createInquiry;
    db.createInquiry = async (args) => {
      await real(args); // committed, but the response is lost
      return { ok: false, code: "" };
    };
    const first = await submitInquiry(valid(), {
      organizationId: ORG,
      now: NOW,
      ...db,
    });
    assert.equal(first.kind === "form" && first.state.formError, "unavailable");
    assert.equal(first.kind === "form" && first.state.requestId, REQUEST_ID);

    db.createInquiry = real;
    const retry = await submitInquiry(valid(), {
      organizationId: ORG,
      now: NOW,
      ...db,
    });
    assert.deepEqual(retry, {
      kind: "created",
      inquiryId: `inquiry-${REQUEST_ID}`,
    });
    assert.equal(db.byRequest.size, 1);
  });

  it("creates one inquiry for concurrent double submissions", async () => {
    const db = fakeDatabase();
    const outcomes = await Promise.all([
      submitInquiry(valid(), { organizationId: ORG, now: NOW, ...db }),
      submitInquiry(valid(), { organizationId: ORG, now: NOW, ...db }),
    ]);
    assert.deepEqual(outcomes[0], outcomes[1]);
    assert.equal(db.byRequest.size, 1);
  });

  it("issues a new request id when the old one was used for other content", async () => {
    const db = fakeDatabase();
    await submitInquiry(valid(), { organizationId: ORG, now: NOW, ...db });
    const edited = form({
      source: "whatsapp",
      clientMessage: "Outra",
      requestId: REQUEST_ID,
    });
    const outcome = await submitInquiry(edited, {
      organizationId: ORG,
      now: NOW,
      ...db,
    });
    assert.equal(
      outcome.kind === "form" && outcome.state.formError,
      "requestReused",
    );
    assert.notEqual(
      outcome.kind === "form" && outcome.state.requestId,
      REQUEST_ID,
    );
  });
});

describe("helpers", () => {
  it("gives inquiry access to Owners and Managers only", () => {
    assert.equal(canAccessInquiries("owner"), true);
    assert.equal(canAccessInquiries("manager"), true);
    assert.equal(canAccessInquiries("member"), false);
  });

  it("maps database errors", () => {
    assert.equal(inquiryErrorKey("42501"), "notAllowed");
    assert.equal(inquiryErrorKey("PGRST301"), "notAllowed");
    assert.equal(inquiryErrorKey("22023"), "invalid");
    assert.equal(inquiryErrorKey("23505"), "requestReused");
    assert.equal(inquiryErrorKey(""), "unavailable");
    assert.equal(inquiryErrorKey(undefined), "unavailable");
  });

  it("accepts only known close reasons", () => {
    assert.equal(isCloseReason("spam"), true);
    assert.equal(isCloseReason("cancelled_event"), false);
    assert.equal(isCloseReason(undefined), false);
  });

  it("previews the whole message on one line, shortened", () => {
    assert.equal(
      snippet("\n\n  Olá! Boa tarde  \n\nQueremos um orçamento."),
      "Olá! Boa tarde Queremos um orçamento.",
    );
    assert.equal(snippet(null), "");
    assert.equal(snippet("a".repeat(200), 10), "aaaaaaaaa…");
  });
});
