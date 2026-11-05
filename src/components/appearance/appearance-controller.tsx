"use client";

import { useLayoutEffect } from "react";
import {
  applyAppearance,
  DARK_SCHEME_QUERY,
  readAppearance,
  subscribeAppearance,
} from "./appearance";

/**
 * Keeps <html data-theme> in sync after the pre-paint script: re-applies it
 * when React resets <html> attributes (development Strict Mode remount),
 * follows OS changes while the preference is "system", and follows changes
 * made in other tabs. Renders nothing.
 */
export function AppearanceController() {
  useLayoutEffect(() => {
    const sync = () => applyAppearance(readAppearance());
    sync();
    const media = window.matchMedia(DARK_SCHEME_QUERY);
    media.addEventListener("change", sync);
    const unsubscribe = subscribeAppearance(sync);
    return () => {
      media.removeEventListener("change", sync);
      unsubscribe();
    };
  }, []);

  return null;
}
