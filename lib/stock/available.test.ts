import { describe, expect, it } from "vitest";
import { bundleAvailable, physicalAvailable } from "./available";

describe("physicalAvailable", () => {
  it("returns stock", () => expect(physicalAvailable(5)).toBe(5));
  it("treats null and negative as 0", () => {
    expect(physicalAvailable(null)).toBe(0);
    expect(physicalAvailable(-2)).toBe(0);
  });
});

describe("bundleAvailable", () => {
  // 一車份 = 前左 + 前右 + 後左 + 後右, one each
  const fullCar = (fl: number, fr: number, rl: number, rr: number) =>
    bundleAvailable([
      { stock: fl, qty: 1 },
      { stock: fr, qty: 1 },
      { stock: rl, qty: 1 },
      { stock: rr, qty: 1 },
    ]);

  it("is limited by the scarcest component", () => {
    expect(fullCar(5, 3, 2, 4)).toBe(2);
  });

  it("drops when a component sells", () => {
    expect(fullCar(5, 3, 2, 4)).toBe(2);
    expect(fullCar(5, 3, 1, 4)).toBe(1);
    expect(fullCar(5, 3, 0, 4)).toBe(0);
  });

  it("floors by component qty", () => {
    expect(bundleAvailable([{ stock: 7, qty: 2 }])).toBe(3);
    expect(bundleAvailable([{ stock: 1, qty: 2 }])).toBe(0);
    expect(
      bundleAvailable([
        { stock: 9, qty: 2 },
        { stock: 10, qty: 3 },
      ]),
    ).toBe(3);
  });

  it("is 0 with no components", () => expect(bundleAvailable([])).toBe(0));

  it("never goes negative when a component is oversold", () => {
    expect(fullCar(5, -1, 2, 4)).toBe(0);
  });

  it("rejects non-positive or fractional qty", () => {
    expect(() => bundleAvailable([{ stock: 5, qty: 0 }])).toThrow();
    expect(() => bundleAvailable([{ stock: 5, qty: 1.5 }])).toThrow();
  });
});
