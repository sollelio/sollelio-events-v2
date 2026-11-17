import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeRedirectPath } from "./redirect.ts";

describe("safeRedirectPath", () => {
  it("keeps same-origin paths with query and fragment", () => {
    assert.equal(safeRedirectPath("/onboarding"), "/onboarding");
    assert.equal(safeRedirectPath("/a/b?x=1&y=2#top"), "/a/b?x=1&y=2#top");
    assert.equal(safeRedirectPath("/"), "/");
  });

  it("normalises harmless dot segments within the site", () => {
    assert.equal(safeRedirectPath("/a/../onboarding"), "/onboarding");
  });

  const rejected: Array<[string, unknown]> = [
    ["absolute URL", "https://evil.example/path"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["embedded backslash", "/ok\\..\\evil"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,hi"],
    ["dot segments resolving to //host", "/..//evil.example"],
    ["single-dot segment resolving to //host", "/.//evil.example"],
    ["leading whitespace", " /onboarding"],
    ["tab inside", "/\t/evil.example"],
    ["newline inside", "/ok\n/evil"],
    ["null byte", "/ok\u0000"],
    ["relative path", "onboarding"],
    ["empty string", ""],
    ["over-long value", `/${"a".repeat(2048)}`],
    ["auth callback (loop)", "/auth/callback?code=abc"],
    ["null", null],
    ["number", 42],
    ["file entry", { name: "x" }],
  ];
  for (const [name, value] of rejected) {
    it(`rejects ${name}`, () => {
      assert.equal(safeRedirectPath(value), "/");
    });
  }

  it("keeps encoded slashes as a same-origin path", () => {
    assert.equal(
      safeRedirectPath("/%2F%2Fevil.example"),
      "/%2F%2Fevil.example",
    );
  });

  it("uses the supplied fallback", () => {
    assert.equal(safeRedirectPath("//evil.example", "/sign-in"), "/sign-in");
  });
});
