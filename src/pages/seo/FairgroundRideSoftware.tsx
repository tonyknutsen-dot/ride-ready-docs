import SeoLandingPage from "@/components/SeoLandingPage";

const FairgroundRideSoftware = () => (
  <SeoLandingPage
    path="/fairground-ride-software"
    metaTitle="Fairground Ride Software | Ride Ready Docs"
    metaDescription="Ride Ready Docs is fairground ride software for operators — digital ride checks, defects, maintenance, documents and expiry reminders, all in one mobile-friendly system."
    h1="Fairground ride software built for operators"
    intro="Ride Ready Docs is fairground ride software for showmen and operators who need to keep checks, documents, maintenance, defects and expiry reminders in one place — and find anything in seconds."
    sections={[
      {
        heading: "One system for every piece of equipment",
        body: "Add your rides, stalls, games, inflatables and support equipment once. Each item has its own record with documents, checks, maintenance history and reminders attached.",
        bullets: [
          "Mobile-friendly — works on the ground, not just in the office",
          "Built for fairground ride operators and travelling showmen",
          "No paperwork to chase, no folders to lose",
        ],
      },
      {
        heading: "Digital ride checks",
        body: "Run daily and pre-opening checks from a phone or tablet. Sign off, capture notes and photos, and keep a clean history of who checked what and when.",
        bullets: [
          "Customisable check templates per ride type",
          "Time-stamped, signed digital records",
          "Quickly recall any check, ride or date",
        ],
      },
      {
        heading: "Compliance records you can find again",
        body: "Store insurance, inspection certificates, manuals and test records against the right equipment. Set expiry dates and get reminders before they lapse.",
        bullets: [
          "Document expiry reminders",
          "Send compliance documents to inspectors or event organisers",
          "Operator-friendly language — no enterprise complexity",
        ],
      },
    ]}
    closingHeading="Replace paper folders with a system that travels with you"
    closingBody="Ride operator software designed for fairgrounds and shows. Start a free trial of Ride Ready Docs and bring your ride records, checks and documents under one roof."
    jsonLd={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Ride Ready Docs",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "Fairground ride software for operators — digital ride checks, defects, maintenance and compliance records.",
      url: "https://ridereadydocs.co.uk/fairground-ride-software",
    }}
  />
);

export default FairgroundRideSoftware;
