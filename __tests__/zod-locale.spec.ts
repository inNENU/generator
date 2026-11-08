import { describe, expect, it } from "vitest";
import * as zod from "zod";

// Importing the library must not mutate the host application's zod config.
import * as librarySchema from "../src/schema/index.js";

describe("zod locale", () => {
  it("should keep the default English messages for host schemas", () => {
    // The library schema itself is still usable after the import.
    expect(librarySchema.locSchema.safeParse("0,0").success).toBe(true);

    const result = zod.string().safeParse(1);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("expected string");
  });
});
