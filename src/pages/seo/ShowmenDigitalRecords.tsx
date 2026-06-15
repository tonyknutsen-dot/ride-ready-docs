import SeoLandingPage from "@/components/SeoLandingPage";

const ShowmenDigitalRecords = () => (
  <SeoLandingPage
    path="/showmen-digital-records"
    metaTitle="Digital Records for Showmen | Ride Ready Docs"
    metaDescription="Replace paper folders, WhatsApp photos and scattered files with organised digital records for showmen. Ride Ready Docs keeps your ride documents, checks and history together."
    h1="Digital records for showmen"
    intro="Showmen are on the move. Ride Ready Docs gives travelling fairground operators a simple, mobile ride operator app so your ride documents, checks and maintenance history live in one place — not across phones, folders and group chats."
    sections={[
      {
        heading: "Stop searching through WhatsApp and folders",
        body: "Every ride has its own digital record. Documents, checks, defects, maintenance and reminders all sit against the right piece of equipment, ready when you need them.",
        bullets: [
          "Plain showmen language — no enterprise jargon",
          "Works from a phone in the yard or on the ground",
          "One source of truth for your ride documents",
        ],
      },
      {
        heading: "Travelling fairground records that move with you",
        body: "Pull up checks, certificates and maintenance history from anywhere with signal. Share documents with event organisers and inspectors in a couple of taps.",
        bullets: [
          "Send compliance documents from your phone",
          "See what is due, overdue or coming up",
          "Bring on new staff without losing knowledge",
        ],
      },
      {
        heading: "Built for how showmen actually work",
        body: "Short forms, clear screens, fast entry. Daily checks, defects and maintenance take minutes — not a clipboard and a re-type later.",
        bullets: [
          "Quick daily and pre-opening checks",
          "Log defects with photos on the spot",
          "Maintenance history you can hand over",
        ],
      },
    ]}
    closingHeading="Modern showmen ride documents, without the paperwork pile"
    closingBody="Ride Ready Docs is the mobile ride operator app for travelling fairgrounds. Start a free trial and replace paper folders with organised digital records."
    jsonLd={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Ride Ready Docs",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "Digital records for showmen and travelling fairground operators — checks, defects, maintenance and documents in one mobile app.",
      url: "https://ridereadydocs.co.uk/showmen-digital-records",
    }}
  />
);

export default ShowmenDigitalRecords;
