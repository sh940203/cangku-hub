import { describe, expect, it } from "vitest";
import { floorColorClass, formatLocationCode, parseLocationCode } from "./code";

describe("location codes", () => {
  it("formats with a padded number and upper-case zone", () => {
    expect(formatLocationCode("4F", "t", 3)).toBe("4F-T-03");
  });
  it("parses valid codes and rejects others", () => {
    expect(parseLocationCode("3F-L-12")).toEqual({ floor: "3F", zone: "L", number: 12 });
    expect(parseLocationCode("2F-A-01")).toBeNull();
    expect(parseLocationCode("1F-A-1")).toBeNull();
  });
  it("picks the floor color, splitting 4F by zone", () => {
    expect(floorColorClass("1F-A-03")).toBe("bg-floor-1f");
    expect(floorColorClass("3F-L-02")).toBe("bg-floor-3f");
    expect(floorColorClass("4F-S-01")).toBe("bg-floor-4f-s");
    expect(floorColorClass("4F-T-05")).toBe("bg-floor-4f-t");
    expect(floorColorClass("4F-X-01")).toBe("bg-floor-4f-t");
  });
});
