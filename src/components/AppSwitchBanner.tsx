import { isDocs, isChecks } from "@/config/appFlavor";

export default function AppSwitchBanner() {
  const otherUrl = isDocs
    ? import.meta.env.VITE_CHECKS_APP_URL
    : import.meta.env.VITE_DOCS_APP_URL;

  if (!otherUrl) return null;

  return (
    <div className="md:hidden text-center text-xs py-2 bg-secondary">
      {isDocs ? "Need Daily/Monthly/Yearly checks?" : "Need documents & sending to councils?"}{" "}
      <a href={otherUrl} className="font-semibold underline">
        Open the {isDocs ? "Checks" : "Docs"} app
      </a>
    </div>
  );
}
