"use client";

import { useEffect, useSyncExternalStore, type FC } from "react";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import {
  buildMetaAdvancedMatchingUserData,
  getMetaAdvancedMatchingPhone,
  subscribeMetaAdvancedMatchingPhone,
} from "@/lib/analytics/meta-pixel-advanced-matching";
import { queueWebisteVisaAdvancedMatching } from "@/lib/analytics/meta-pixel-client";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";

const META_PIXEL_READY_EVENT = "visatop:meta-pixel-ready";

/**
 * When a signed-in customer is known, re-init WebisteVisa with plain em / ph / external_id.
 * Phone is contact digits (country code included), never passport or document fields.
 */
export const MetaPixelAdvancedMatching: FC = () => {
  const session = useClientAuthStore((s) => s.session);
  const phone = useSyncExternalStore(
    subscribeMetaAdvancedMatchingPhone,
    getMetaAdvancedMatchingPhone,
    () => null,
  );

  useEffect(() => {
    if (!session?.user?.id) return;
    if (typeof window !== "undefined" && isAnalyticsExcludedPath(window.location.pathname)) {
      return;
    }
    const data = buildMetaAdvancedMatchingUserData({
      email: session.user.email,
      phone,
      userId: session.user.id,
    });
    if (!data) return;
    queueWebisteVisaAdvancedMatching(data);
  }, [session, phone]);

  useEffect(() => {
    const onReady = () => {
      if (!session?.user?.id) return;
      const data = buildMetaAdvancedMatchingUserData({
        email: session.user.email,
        phone: getMetaAdvancedMatchingPhone(),
        userId: session.user.id,
      });
      if (!data) return;
      queueWebisteVisaAdvancedMatching(data);
    };
    window.addEventListener(META_PIXEL_READY_EVENT, onReady);
    return () => window.removeEventListener(META_PIXEL_READY_EVENT, onReady);
  }, [session]);

  return null;
};
