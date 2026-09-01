import type { Metadata } from "next";
import { ClientAppHeader } from "@/components/client/client-app-header";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { WhatsAppExpertCtaButton } from "@/components/client/whatsapp-expert-cta-button";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_LP_URL } from "@/lib/support-contact";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Speak with a Visa Expert",
  description:
    "Get instant answers and personalized UAE visa guidance from the Visatop team on WhatsApp.",
  robots: { index: false, follow: true },
};

const SpeakWithAnExpertPage = () => {
  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(40vh,420px)] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(252,205,100,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 py-10 sm:px-4 md:py-14">
          <ClientHeroPanel
            className={cn(
              "theme-client-rise border-secondary/40 from-card via-card to-muted/60 mx-auto max-w-2xl border-[3px] p-8 shadow-[0_28px_72px_rgba(1,32,49,0.14)] md:p-12",
            )}
          >
            <section aria-labelledby="expert-headline">
              <p className="text-secondary text-center text-[11px] font-bold uppercase tracking-[0.28em]">
                UAE Visa Support
              </p>
              <h1
                id="expert-headline"
                className="font-heading text-foreground mt-6 text-center text-[2rem] leading-[1.2] font-semibold md:text-[2.25rem]"
              >
                Speak with our Expert
              </h1>
              <p className="text-muted-foreground mt-6 text-center text-base leading-relaxed md:text-lg">
                Tell us your nationality and travel dates. Our visa specialists reply on WhatsApp with clear next steps,
                pricing, and document guidance — no obligation to apply online.
              </p>

              <div className="mt-8">
                <WhatsAppExpertCtaButton href={SUPPORT_WHATSAPP_LP_URL} />
              </div>

              <p className="text-muted-foreground mt-4 text-center text-sm">
                Typical reply within minutes during UAE business hours ({SUPPORT_PHONE_DISPLAY}).
              </p>
            </section>

            <section
              id="privacy-policy"
              aria-labelledby="privacy-heading"
              className="border-secondary/20 mt-10 border-t pt-8"
            >
              <h2 id="privacy-heading" className="font-heading text-foreground text-lg font-semibold">
                Privacy Policy
              </h2>
              <div className="text-muted-foreground mt-3 space-y-3 text-sm leading-relaxed">
                <p>
                  Visatop (&quot;we&quot;, &quot;us&quot;) operates this page to help visitors contact our visa support
                  team through WhatsApp. When you tap the button above, you open a chat with our official business number
                  on Meta&apos;s WhatsApp service. Messages you send, your phone number, and any information you choose
                  to share in chat are processed so we can respond to your enquiry and provide visa-related assistance.
                </p>
                <p>
                  We use this information only to communicate about UAE visa services, quotes, and application support.
                  We do not sell your personal data. We retain chat records only as long as needed for customer service,
                  legal, or accounting requirements, then delete or anonymize them where appropriate.
                </p>
                <p>
                  This page uses privacy-friendly analytics tags to measure whether visitors find the WhatsApp option
                  helpful. We do not use this page for unrelated advertising profiles. For questions about your data or
                  to request deletion, email{" "}
                  <a href="mailto:info@visatop.com" className="text-link font-medium hover:underline">
                    info@visatop.com
                  </a>{" "}
                  or write to us via WhatsApp at {SUPPORT_PHONE_DISPLAY}.
                </p>
                <p className="text-xs">Last updated: August 2026</p>
              </div>
            </section>
          </ClientHeroPanel>
        </div>
      </div>
    </div>
  );
};

export default SpeakWithAnExpertPage;
