import { describe, expect, it } from "vitest";
import { icaoCheckDigit, mrzCheckDigitsValid, mrzVisualAgrees, parseTd3Line2 } from "./mrz-check";

describe("icaoCheckDigit", () => {
  it("matches the ICAO 9303 example passport number L898902C3", () => {
    expect(icaoCheckDigit("L898902C3")).toBe("6");
  });

  it("matches the example dates of birth and expiry", () => {
    expect(icaoCheckDigit("740812")).toBe("2");
    expect(icaoCheckDigit("120415")).toBe("9");
  });
});

describe("parseTd3Line2", () => {
  const line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";

  it("accepts the ICAO example line 2", () => {
    expect(parseTd3Line2(line2)).toEqual({
      passportNumber: "L898902C3",
      dateOfBirth: "740812",
      passportExpiryDate: "120415",
    });
  });

  it("rejects a line with a broken passport check digit", () => {
    expect(parseTd3Line2("L898902C30UTO7408122F1204159ZE184226B<<<<<10")).toBeNull();
  });
});

describe("mrzCheckDigitsValid", () => {
  const line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
  const line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";

  it("requires both 44-char lines and valid check digits", () => {
    expect(mrzCheckDigitsValid(line1, line2)).toBe(true);
    expect(mrzCheckDigitsValid(line1, null)).toBe(false);
    expect(mrzCheckDigitsValid("short", line2)).toBe(false);
  });
});

describe("mrzVisualAgrees", () => {
  const mrz = {
    passportNumber: "L898902C3",
    dateOfBirth: "740812",
    passportExpiryDate: "120415",
  };

  it("agrees when visual-zone values match the MRZ", () => {
    expect(
      mrzVisualAgrees(mrz, {
        passportNumber: "L898902C3",
        dateOfBirth: "1974-08-12",
        passportExpiryDate: "2012-04-15",
      }),
    ).toBe(true);
  });

  it("rejects a visual-zone identity that does not match the MRZ", () => {
    expect(
      mrzVisualAgrees(mrz, {
        passportNumber: "A7891011",
        dateOfBirth: "1975-05-12",
        passportExpiryDate: "2028-10-08",
      }),
    ).toBe(false);
  });
});
