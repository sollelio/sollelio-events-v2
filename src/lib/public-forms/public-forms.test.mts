import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  answerFieldName,
  buildAnswers,
  checkAnswers,
  parsePublicForm,
  publicFormErrorKey,
  type PublicQuestion,
} from "./form.ts";
import {
  isServiceDatabaseUrl,
  SERVICE_ROLE_NAME,
  serviceDatabaseOptions,
} from "./connection.ts";
import {
  clientFingerprint,
  MAX_TOKEN_AGE_MS,
  parseTrustedProxyHops,
  signRenderToken,
  trustedClientAddress,
  verifyRenderToken,
} from "./token.ts";

const SECRET = "test-signing-secret-0123456789abcdef";
const KEY = "AbCdEfGhIjKlMnOpQrStUv";
const VERSION = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const T0 = 1_800_000_000_000;

const q = (
  id: string,
  kind: PublicQuestion["kind"],
  extra: Partial<PublicQuestion> = {},
): PublicQuestion => ({
  id,
  position: 1,
  kind,
  label: id,
  helpText: null,
  required: false,
  options: null,
  binding: null,
  ...extra,
});

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const DEFAULT_FORM: PublicQuestion[] = [
  q(ID(1), "short_text", { binding: "requester_name" }),
  q(ID(2), "short_text", { binding: "requester_email" }),
  q(ID(3), "short_text", { binding: "requester_phone" }),
  q(ID(4), "long_text", { binding: "client_message", required: true }),
  q(ID(5), "date", { binding: "requested_event_date" }),
  q(ID(6), "number", { binding: "estimated_guests" }),
];

describe("render token", () => {
  const token = signRenderToken(SECRET, {
    key: KEY,
    versionId: VERSION,
    issuedAt: T0,
  });
  const check = (
    t: unknown,
    now: number,
    expected = { key: KEY, versionId: VERSION },
  ) => verifyRenderToken(SECRET, t, expected, now);

  it("accepts a genuine token at any age up to the maximum, however fast", () => {
    assert.equal(check(token, T0), "ok");
    assert.equal(check(token, T0 + 500), "ok");
    assert.equal(check(token, T0 + MAX_TOKEN_AGE_MS), "ok");
  });

  it("refuses expired or future-dated tokens", () => {
    assert.equal(check(token, T0 + MAX_TOKEN_AGE_MS + 1), "expired");
    assert.equal(check(token, T0 - 1), "expired");
  });

  it("is bound to its link, version, time and secret", () => {
    assert.equal(
      check(token, T0 + 5_000, {
        key: "XbCdEfGhIjKlMnOpQrStUv",
        versionId: VERSION,
      }),
      "invalid",
    );
    assert.equal(
      check(token, T0 + 5_000, { key: KEY, versionId: ID(9) }),
      "invalid",
    );
    const forgedTime = token.replace(String(T0), String(T0 - 60_000));
    assert.equal(check(forgedTime, T0 + 5_000), "invalid");
    assert.equal(
      verifyRenderToken(
        "another-secret-0123456789abcdefghij",
        token,
        { key: KEY, versionId: VERSION },
        T0 + 5_000,
      ),
      "invalid",
    );
    for (const bad of [undefined, "", "abc", `${T0}.short`, 42]) {
      assert.equal(check(bad, T0 + 5_000), "invalid");
    }
  });
});

describe("client fingerprint", () => {
  it("is a stable 64-character hex HMAC that does not contain the address", () => {
    const a = clientFingerprint(SECRET, "203.0.113.7");
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, clientFingerprint(SECRET, "203.0.113.7"));
    assert.notEqual(a, clientFingerprint(SECRET, "203.0.113.8"));
    assert.notEqual(
      a,
      clientFingerprint("other-secret-0123456789abcdefghijkl", "203.0.113.7"),
    );
    assert.ok(!a.includes("203"));
  });
});

describe("trusted client address", () => {
  const headers = (values: Record<string, string>) => ({
    get: (n: string) => values[n] ?? null,
  });
  const xff = (value: string) => headers({ "x-forwarded-for": value });

  it("trusts nothing until the proxy hops are configured", () => {
    assert.equal(trustedClientAddress(xff("198.51.100.1"), null), null);
    for (const bad of [undefined, "", "0", "6", "1.5", " two ", "-1"]) {
      assert.equal(parseTrustedProxyHops(bad), null, String(bad));
    }
    assert.equal(parseTrustedProxyHops(" 2 "), 2);
  });

  it("takes the entry the trusted proxies appended, not the client's", () => {
    // One overwriting edge (e.g. Vercel as the outermost proxy).
    assert.equal(trustedClientAddress(xff("198.51.100.1"), 1), "198.51.100.1");
    // A spoofed value in front of the address the proxy appended.
    assert.equal(
      trustedClientAddress(xff("203.0.113.66, 198.51.100.1"), 1),
      "198.51.100.1",
    );
    // Two appending proxies: the client is second from the right.
    assert.equal(
      trustedClientAddress(xff("203.0.113.66, 198.51.100.1, 10.0.0.2"), 2),
      "198.51.100.1",
    );
    assert.equal(trustedClientAddress(xff("2001:db8::1"), 1), "2001:db8::1");
  });

  it("refuses missing, short or malformed values and ignores X-Real-IP", () => {
    assert.equal(trustedClientAddress(headers({}), 1), null);
    assert.equal(trustedClientAddress(xff("198.51.100.1"), 2), null);
    assert.equal(trustedClientAddress(xff("unknown"), 1), null);
    assert.equal(trustedClientAddress(xff("198.51.100.1:443"), 1), null);
    assert.equal(
      trustedClientAddress(headers({ "x-real-ip": "198.51.100.2" }), 1),
      null,
    );
  });
});

describe("service database connection", () => {
  it("accepts only the service role's connection string", () => {
    const ok = `postgres://${SERVICE_ROLE_NAME}.abcdefghijklmnopqrst:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
    assert.equal(isServiceDatabaseUrl(ok), true);
    assert.equal(
      isServiceDatabaseUrl(
        `postgresql://${SERVICE_ROLE_NAME}:pw@db.local/postgres`,
      ),
      true,
    );
    for (const bad of [
      "",
      "not a url",
      ok.replace(SERVICE_ROLE_NAME, "postgres"),
      ok.replace(SERVICE_ROLE_NAME, "service_role"),
      ok.replace(SERVICE_ROLE_NAME, `${SERVICE_ROLE_NAME}x`),
      ok.replace(":pw@", "@"),
      ok.replace("postgres://", "https://"),
    ]) {
      assert.equal(isServiceDatabaseUrl(bad), false, bad);
    }
  });

  it("verifies TLS, avoids prepared statements and stays small", () => {
    const options = serviceDatabaseOptions("PEM");
    assert.deepEqual(options.ssl, { ca: "PEM", rejectUnauthorized: true });
    assert.equal(options.prepare, false);
    assert.ok(options.max <= 2);
  });
});

describe("buildAnswers", () => {
  it("types answers by kind and leaves out empty ones", () => {
    const form = new FormData();
    form.set(
      answerFieldName({ id: ID(4), kind: "long_text" }),
      "  Olá!\nQueremos um orçamento.  ",
    );
    form.set(answerFieldName({ id: ID(6), kind: "number" }), "120");
    form.set(answerFieldName({ id: ID(5), kind: "date" }), "2027-06-12");
    form.set(answerFieldName({ id: ID(1), kind: "short_text" }), "   ");
    form.append(answerFieldName({ id: ID(7), kind: "multiple_choice" }), "a");
    form.append(answerFieldName({ id: ID(7), kind: "multiple_choice" }), "b");
    form.append(answerFieldName({ id: ID(7), kind: "multiple_choice" }), "a");
    form.set("answer:not_a_kind:" + ID(8), "x");
    form.set("sf_hp_field", "bot");
    const { answers, echoed } = buildAnswers(form);
    assert.deepEqual(answers, {
      [ID(4)]: "Olá!\nQueremos um orçamento.",
      [ID(6)]: 120,
      [ID(5)]: "2027-06-12",
      [ID(7)]: ["a", "b"],
    });
    assert.equal(echoed[ID(1)], "   ", "values are echoed exactly as typed");
  });

  it("accepts a decimal comma and keeps non-numbers as text for rejection", () => {
    const form = new FormData();
    form.set(answerFieldName({ id: ID(6), kind: "number" }), "1,5");
    form.set(answerFieldName({ id: ID(9), kind: "number" }), "cento e vinte");
    const { answers } = buildAnswers(form);
    assert.equal(answers[ID(6)], 1.5);
    assert.equal(answers[ID(9)], "cento e vinte");
  });
});

describe("checkAnswers (default Inquiry form)", () => {
  it("accepts a message with either email or phone", () => {
    assert.deepEqual(
      checkAnswers(DEFAULT_FORM, {
        [ID(4)]: "Olá",
        [ID(2)]: "ana@example.test",
      }),
      {},
    );
    assert.deepEqual(
      checkAnswers(DEFAULT_FORM, {
        [ID(4)]: "Olá",
        [ID(3)]: "+351 912 000 000",
      }),
      {},
    );
  });

  it("requires the message and at least one contact", () => {
    assert.deepEqual(checkAnswers(DEFAULT_FORM, {}), {
      [ID(4)]: "required",
      [ID(2)]: "contactRequired",
      [ID(3)]: "contactRequired",
    });
  });

  it("checks bound formats like the database", () => {
    const errors = checkAnswers(DEFAULT_FORM, {
      [ID(4)]: "Olá",
      [ID(2)]: "ana@",
      [ID(3)]: "sem número",
      [ID(1)]: "Ana\nMarques",
      [ID(5)]: "2027-02-30",
      [ID(6)]: 1.5,
    });
    assert.deepEqual(errors, {
      [ID(2)]: "email",
      [ID(3)]: "phone",
      [ID(1)]: "singleLine",
      [ID(5)]: "date",
      [ID(6)]: "wholeNumber",
    });
  });

  it("checks choices against the version's options", () => {
    const questions = [
      q(ID(1), "single_choice", {
        required: true,
        options: [{ key: "a", label: "A" }],
      }),
      q(ID(2), "multiple_choice", {
        options: [
          { key: "x", label: "X" },
          { key: "y", label: "Y" },
        ],
      }),
    ];
    assert.deepEqual(
      checkAnswers(questions, { [ID(1)]: "a", [ID(2)]: ["x", "y"] }),
      {},
    );
    assert.deepEqual(
      checkAnswers(questions, { [ID(1)]: "b", [ID(2)]: ["z"] }),
      {
        [ID(1)]: "choice",
        [ID(2)]: "choice",
      },
    );
  });
});

describe("errors and parsing", () => {
  it("maps database errors to messages", () => {
    assert.equal(publicFormErrorKey("SF002"), "versionChanged");
    assert.equal(publicFormErrorKey("SF003"), "rateLimited");
    assert.equal(publicFormErrorKey("22023"), "invalid");
    assert.equal(publicFormErrorKey("SF001"), "unavailable");
    assert.equal(publicFormErrorKey("42501"), "unavailable");
    assert.equal(publicFormErrorKey("57014"), "unavailable");
    assert.equal(publicFormErrorKey(undefined), "unavailable");
  });

  it("parses get_public_form defensively", () => {
    assert.equal(parsePublicForm(null), null);
    assert.equal(parsePublicForm({ title: "x" }), null);
    const parsed = parsePublicForm({
      organizationName: "Org",
      formVersionId: VERSION,
      title: "Pedido",
      intro: null,
      questions: [
        {
          id: ID(1),
          position: 1,
          kind: "short_text",
          label: "Nome",
          required: false,
          binding: "requester_name",
        },
      ],
    });
    assert.equal(parsed?.questions[0]?.binding, "requester_name");
    assert.equal(
      parsePublicForm({
        organizationName: "Org",
        formVersionId: VERSION,
        title: "x",
        questions: [{ id: ID(1), kind: "upload", label: "x" }],
      }),
      null,
      "unknown question kinds are refused",
    );
  });
});

describe("database contract", () => {
  const MIGRATION = new URL(
    "../../../supabase/migrations/20261118120000_public_forms.sql",
    import.meta.url,
  );
  const params = (sql: string, fn: string) => {
    const match = new RegExp(
      `create function ${(fn.includes(".") ? fn : `public.${fn}`).replace(".", "\\.")}\\(([^)]*)\\)`,
    ).exec(sql);
    assert.ok(match?.[1], `${fn} not found`);
    return match[1]
      .split(",")
      .map((p) => p.trim().split(/\s+/)[0])
      .filter(Boolean);
  };

  it("the functions take the arguments the server sends, in order", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    assert.deepEqual(params(sql, "form_service.get_public_form"), [
      "p_public_key",
    ]);
    assert.deepEqual(params(sql, "form_service.submit_public_form"), [
      "p_public_key",
      "p_form_version_id",
      "p_request_id",
      "p_fingerprint",
      "p_answers",
    ]);
    assert.deepEqual(params(sql, "enable_public_inquiry_form"), [
      "p_organization_id",
    ]);
    assert.deepEqual(params(sql, "rotate_public_form_link"), ["p_link_id"]);
    assert.deepEqual(params(sql, "revoke_public_form_link"), ["p_link_id"]);
  });

  it("question kinds match the database enum", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const match =
      /create type public\.form_question_kind as enum \(([^)]*)\)/.exec(sql);
    const kinds = [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1],
    );
    const { QUESTION_KINDS } = await import("./form.ts");
    assert.deepEqual(kinds, [...QUESTION_KINDS]);
  });
});
