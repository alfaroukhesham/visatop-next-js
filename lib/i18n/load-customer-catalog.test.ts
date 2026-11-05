import { describe, expect, it } from "vitest";
import {
  createCustomerT,
  customerInLanguageTag,
  getCustomerMessages,
  getEnglishCustomerMessages,
} from "./load-customer-catalog";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "./customer-locale";

const leafKeys = (tree: unknown, prefix = ""): string[] => {
  if (typeof tree !== "object" || tree === null || Array.isArray(tree)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key),
  );
};

describe("getCustomerMessages", () => {
  it("returns English for unknown locales", () => {
    expect(getCustomerMessages("xx")).toBe(getEnglishCustomerMessages());
    expect(createCustomerT("xx")("home.headlineLine1")).toBe("Traveling to Dubai?");
  });

  it("returns French copy for fr", () => {
    expect(createCustomerT("fr")("home.headlineLine1")).not.toBe("Traveling to Dubai?");
    expect(createCustomerT("fr")("home.headlineLine1").length).toBeGreaterThan(0);
  });

  it("keeps the same leaf keys as English for every catalog locale", () => {
    const enKeys = leafKeys(getEnglishCustomerMessages()).sort();
    for (const locale of FALLBACK_CUSTOMER_LOCALE_SLUGS) {
      expect(leafKeys(getCustomerMessages(locale)).sort(), locale).toEqual(enKeys);
    }
  });

  it("localizes ready-step copy in EN, AR, and FR", () => {
    const en = createCustomerT("en");
    const ar = createCustomerT("ar");
    const fr = createCustomerT("fr");
    expect(en("wizard.readyTitle")).toBe("What you'll need");
    expect(ar("wizard.readyTitle")).toBe("ما ستحتاج إليه");
    expect(fr("wizard.readyTitle")).toBe("Ce dont vous aurez besoin");
    expect(en("wizard.continueWithDocuments")).toBe("I have these - Continue");
    expect(ar("wizard.continueWithDocuments")).toBe("لديّ هذه المستندات - متابعة");
    expect(fr("wizard.continueWithDocuments")).toBe("J'ai ces documents - Continuer");
    expect(en("wizard.jumpAheadHint")).toMatch(/Finish this step first/);
    expect(ar("wizard.jumpAheadHint")).toMatch(/أكمل هذه الخطوة أولاً/);
    expect(fr("wizard.jumpAheadHint")).toMatch(/Terminez d'abord/);
    expect(en("steps.trip")).toBe("Trip");
    expect(ar("steps.trip")).toBe("الرحلة");
    expect(fr("steps.trip")).toBe("Voyage");
    expect(ar("steps.details")).toBe("البيانات");
    expect(fr("steps.details")).toBe("Infos");
    expect(en("steps.meta", { n: 2, label: "Documents" })).toBe("Step 2 of 5 · Documents");
    expect(en("wizard.readyInstruction")).toMatch(/Tap a name for formats/);
    expect(ar("wizard.readyInstruction")).toMatch(/اضغط على الاسم/);
    expect(fr("wizard.readyInstruction")).toMatch(/Touchez un nom/);
    expect(ar("wizard.neededNow")).toBe("مطلوب الآن");
    expect(fr("wizard.neededNow")).toBe("Nécessaire maintenant");
    expect(ar("wizard.addLater")).toBe("يمكن إضافته لاحقاً");
    expect(fr("wizard.addLater")).toBe("Peut être ajouté plus tard");
    expect(ar("wizard.otherTitle")).toBe("مستندات أخرى");
    expect(fr("wizard.otherTitle")).toBe("Autres documents");
    expect(ar("wizard.detailsTitle")).toBe("تحقق من بياناتك");
    expect(fr("wizard.detailsTitle")).toBe("Vérifiez vos informations");
    expect(ar("steps.pay")).toBe("الدفع");
    expect(fr("steps.pay")).toBe("Payer");
    expect(ar("steps.finish")).toBe("إنهاء");
    expect(fr("steps.finish")).toBe("Fin");
    expect(ar("common.previous")).toBe("السابق");
    expect(fr("common.previous")).toBe("Précédent");
    expect(ar("documents.slots.personalPhoto.label")).toBe("صورة شخصية");
    expect(fr("documents.slots.personalPhoto.label")).toBe("Photo d'identité");
  });

  it("maps English to en-GB for JSON-LD", () => {
    expect(customerInLanguageTag("en")).toBe("en-GB");
    expect(customerInLanguageTag("ar")).toBe("ar");
  });

  it("uses a shorter home nationality placeholder for narrow viewports in en, ar, and fr", () => {
    for (const locale of ["en", "ar", "fr"] as const) {
      const t = createCustomerT(locale);
      const full = t("home.nationalityPlaceholder");
      const narrow = t("home.nationalityPlaceholderNarrow");
      const compact = t("home.nationalityPlaceholderCompact");
      expect(narrow.length, locale).toBeGreaterThan(0);
      expect(narrow.length, locale).toBeLessThan(full.length);
      expect(compact.length, locale).toBeGreaterThan(0);
      expect(compact.length, locale).toBeLessThanOrEqual(narrow.length);
    }
    expect(createCustomerT("en")("home.nationalityPlaceholderNarrow")).toBe("Your passport");
    expect(createCustomerT("ar")("home.nationalityPlaceholderNarrow")).toBe("جواز سفرك");
    expect(createCustomerT("fr")("home.nationalityPlaceholderNarrow")).toBe("Votre passeport");
    expect(createCustomerT("en")("home.nationalityPlaceholderCompact")).toBe("Passport");
    expect(createCustomerT("ar")("home.nationalityPlaceholderCompact")).toBe("الجواز");
    expect(createCustomerT("fr")("home.nationalityPlaceholderCompact")).toBe("Passeport");
  });
});
