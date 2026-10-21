import { describe, expect, it } from "vitest";
import { formatTime } from "../src";

describe("formatTime", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [59.9, "0:59"],
    [65, "1:05"],
    [3600, "1:00:00"],
    [3725.9, "1:02:05"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });

  it.each([Number.NaN, -3, Number.POSITIVE_INFINITY])("reads %s as 0:00", (seconds) => {
    expect(formatTime(seconds)).toBe("0:00");
  });
});
