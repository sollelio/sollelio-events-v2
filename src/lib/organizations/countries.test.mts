import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { COUNTRY_CODES, countryName, countryOptions } from "./countries.ts";

const MIGRATION = new URL(
  "../../../supabase/migrations/20261114133030_organizations_and_memberships.sql",
  import.meta.url,
);

describe("country list", () => {
  it("matches private.country_codes in the migration", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const insert =
      /insert into private\.country_codes \(code\) values([^;]+);/.exec(
        sql,
      )?.[1];
    assert.ok(insert, "country_codes insert not found");
    const fromMigration = [...insert.matchAll(/'([A-Z]{2})'/g)].map(
      (match) => match[1],
    );
    assert.equal(fromMigration.length, 249);
    assert.deepEqual([...COUNTRY_CODES].sort(), fromMigration.sort());
  });

  it("names every country in European Portuguese, sorted by name", () => {
    const options = countryOptions("pt-PT");
    assert.equal(options.length, COUNTRY_CODES.length);
    for (const { code, name } of options) {
      assert.notEqual(name, code, `no name for ${code}`);
    }
    const names = options.map((option) => option.name);
    const collator = new Intl.Collator("pt-PT");
    assert.deepEqual(names, [...names].sort(collator.compare));
    assert.equal(countryName("AO", "pt-PT"), "Angola");
    assert.equal(countryName("PT", "pt-PT"), "Portugal");
  });
});
