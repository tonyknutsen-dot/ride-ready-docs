import SeoLandingPage from "@/components/SeoLandingPage";

const InflatableOperatorRecords = () => (
  <SeoLandingPage
    path="/inflatable-operator-records"
    metaTitle="Inflatable Operator Records | Ride Ready Docs"
    metaDescription="Inflatable operator records made simple — wind logs, pressure readings, daily checks, documents and expiry reminders for inflatables and bouncy castle compliance records."
    h1="Inflatable operator records — wind, pressure and checks together"
    intro="Ride Ready Docs keeps inflatable operator records, wind logs, pressure readings and daily checks in one mobile-friendly system. Built so a small team can stay on top of bouncy castle compliance records without paperwork getting in the way."
    sections={[
      {
        heading: "Inflatable wind logs that take seconds",
        body: "Capture wind readings from a phone, with the time, equipment and operator already attached. Build a clear inflatable wind log history you can show on demand.",
        bullets: [
          "Quick wind log entry on a phone",
          "History per inflatable and per day",
          "No more loose notes or rewritten paper logs",
        ],
      },
      {
        heading: "Inflatable pressure logs",
        body: "Record pressure readings against the right inflatable. Spot anything out of range early and keep a clean log for your own records and anyone who needs to see them.",
        bullets: [
          "Pressure readings linked to each inflatable",
          "Warnings on readings outside your normal range",
          "Searchable history when you need to recall a date",
        ],
      },
      {
        heading: "Daily checks, documents and expiry reminders",
        body: "Run inflatable daily checks digitally, store insurance, test certificates and manuals against each unit, and get reminders before anything lapses.",
        bullets: [
          "Inflatable daily checks with sign-off",
          "Documents stored per inflatable",
          "Automatic expiry reminders for certificates and insurance",
        ],
      },
    ]}
    closingHeading="Keep your inflatable hire business organised and ready"
    closingBody="From bouncy castles to large inflatables, Ride Ready Docs keeps your checks, wind logs, pressure readings and compliance records in one place. Start a free trial today."
    jsonLd={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Ride Ready Docs",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "Inflatable operator records — wind logs, pressure readings, daily checks and document storage for inflatable hire businesses.",
      url: "https://ridereadydocs.co.uk/inflatable-operator-records",
    }}
  />
);

export default InflatableOperatorRecords;
