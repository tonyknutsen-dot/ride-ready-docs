import SeoLandingPage from "@/components/SeoLandingPage";

const RideChecksDefectMaintenance = () => (
  <SeoLandingPage
    path="/ride-checks-defect-maintenance"
    metaTitle="Daily Checks, Defects & Maintenance Logs | Ride Ready Docs"
    metaDescription="A daily ride checks app with a built-in ride defect register and full maintenance records. Ride Ready Docs keeps amusement ride check records searchable and ready."
    h1="Daily checks, defects and maintenance — in one place"
    intro="Ride Ready Docs is the daily ride checks app for fairground operators. Run pre-opening checks, raise defects with photos, log maintenance and find any record again in seconds."
    sections={[
      {
        heading: "Daily ride checks made quick",
        body: "Use ready-made or custom check templates for each ride. Operators tick, sign and add notes from a phone — no clipboard, no re-typing.",
        bullets: [
          "Customisable templates per ride type",
          "Digital signatures and timestamps",
          "Capture weather conditions and notes",
        ],
      },
      {
        heading: "Ride defect register",
        body: "Spot it, log it, close it. The defect register keeps every issue tracked from first report through to the action that closed it — so nothing is forgotten and nothing slips between staff.",
        bullets: [
          "Photos and notes attached to each defect",
          "Status visible to the right people",
          "Closure actions recorded for the audit trail",
        ],
      },
      {
        heading: "Maintenance records, always findable",
        body: "Log every job against the ride it was done on. Build up amusement ride check records and maintenance history you can search, filter and hand to inspectors or new operators.",
        bullets: [
          "Full maintenance history per ride",
          "Attach photos, receipts and supporting documents",
          "Quickly recall what was done, when, and by whom",
        ],
      },
    ]}
    closingHeading="Stop losing checks and defects in paper and group chats"
    closingBody="Bring your daily checks, defect register and maintenance records into one mobile-friendly system. Start a free trial of Ride Ready Docs today."
    jsonLd={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Ride Ready Docs",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "Daily ride checks app with defect register and maintenance records for amusement ride operators.",
      url: "https://ridereadydocs.co.uk/ride-checks-defect-maintenance",
    }}
  />
);

export default RideChecksDefectMaintenance;
