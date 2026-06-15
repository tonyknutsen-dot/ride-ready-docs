import SeoLandingPage from "@/components/SeoLandingPage";

const RideDocumentManagement = () => (
  <SeoLandingPage
    path="/ride-document-management"
    metaTitle="Ride Document Management | Ride Ready Docs"
    metaDescription="Ride document management for fairgrounds — inspection certificate storage, insurance, expiry reminders and one-tap sharing of ride compliance documents."
    h1="Ride document management for fairgrounds and operators"
    intro="Ride Ready Docs is ride document management built for operators. Store inspection certificates, insurance and ride compliance documents against the right equipment, with expiry reminders and easy sending to whoever needs a copy."
    sections={[
      {
        heading: "Inspection certificate storage that makes sense",
        body: "Upload inspection certificates, test records and manuals against the ride they belong to. Find any certificate in seconds, instead of digging through folders or email.",
        bullets: [
          "Inspection certificates stored per ride",
          "PDFs, photos, Word and more supported",
          "Searchable and filterable document library",
        ],
      },
      {
        heading: "Insurance and compliance documents in one place",
        body: "Public liability, employer's liability, manuals, statutory inspection reports — all in one place, with the right document attached to the right equipment.",
        bullets: [
          "Insurance documents you can pull up on a phone",
          "Compliance documents per ride and global",
          "Send documents to event organisers in a couple of taps",
        ],
      },
      {
        heading: "Expiry reminders so nothing lapses",
        body: "Add an expiry date and Ride Ready Docs takes care of the chasing. Know what is due, what is coming up and what needs renewing before it becomes a problem.",
        bullets: [
          "Automatic document expiry reminders",
          "Clear view of what needs attention",
          "Renewal history kept against each document",
        ],
      },
    ]}
    closingHeading="Bring your ride compliance documents under one roof"
    closingBody="Ride Ready Docs gives fairground operators proper ride document management — inspection certificate storage, insurance, expiry reminders and quick sharing. Start a free trial today."
    jsonLd={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Ride Ready Docs",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "Ride document management with inspection certificate storage, insurance, expiry reminders and document sharing for fairground operators.",
      url: "https://ridereadydocs.co.uk/ride-document-management",
    }}
  />
);

export default RideDocumentManagement;
