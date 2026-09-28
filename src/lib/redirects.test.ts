import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/day/7")).toBe("/day/7");
    expect(safeNextPath("/roadmap?x=1")).toBe("/roadmap?x=1");
  });

  it.each([null, undefined, "", "day/7", "https://evil.example", "//evil.example", "/\\evil.example", "/\\/evil"])(
    "falls back to / for %s",
    (value) => expect(safeNextPath(value)).toBe("/"),
  );
});
