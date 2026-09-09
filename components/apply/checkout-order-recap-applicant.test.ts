import { describe, expect, it } from "vitest";
import { applicantForPaymentRecap } from "@/components/apply/checkout-order-recap";

const empty = {
  fullName: null,
  dateOfBirth: null,
  placeOfBirth: null,
  nationality: null,
  passportNumber: null,
  passportExpiryDate: null,
  profession: null,
  address: null,
  phone: null,
};

describe("applicantForPaymentRecap", () => {
  it("prefers live applicant over the SSR snapshot", () => {
    const live = { ...empty, fullName: "Ada Lovelace", passportNumber: "A1" };
    expect(applicantForPaymentRecap(empty, live).fullName).toBe("Ada Lovelace");
  });

  it("falls back to the SSR snapshot until live data arrives", () => {
    const ssr = { ...empty, fullName: "From SSR" };
    expect(applicantForPaymentRecap(ssr, null).fullName).toBe("From SSR");
  });
});
