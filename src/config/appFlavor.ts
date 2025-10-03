export type AppFlavor = "docs" | "checks";

export const APP_FLAVOR: AppFlavor =
  (import.meta.env.VITE_APP_FLAVOR as AppFlavor) || "docs";

export const isDocs = APP_FLAVOR === "docs";
export const isChecks = APP_FLAVOR === "checks";
