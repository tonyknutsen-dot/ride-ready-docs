import { isDocs, isChecks } from "@/config/appFlavor";
import { useTerminology } from "@/hooks/useTerminology";

export default function AppSwitchBanner() {
  const { terminology } = useTerminology();
  const otherUrl = isDocs
    ? import.meta.env.VITE_CHECKS_APP_URL
    : import.meta.env.VITE_DOCS_APP_URL;

  if (!otherUrl) return null;

  const docsDescription = terminology.isUK 
    ? "Need documents & sending to councils?" 
    : "Need documents & sending to authorities?";

  return (
    <div className="md:hidden text-center text-xs py-2 bg-secondary">
      {isDocs ? "Need operations & maintenance?" : docsDescription}{" "}
      <a href={otherUrl} className="font-semibold underline">
        Open the {isDocs ? "Operations" : "Docs"} app
      </a>
    </div>
  );
}