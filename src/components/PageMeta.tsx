import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;
}

const ORIGIN = "https://ridereadydocs.co.uk";

/**
 * Per-route head metadata. Sets a unique title, meta description,
 * canonical link, and Open Graph tags for each public route.
 * Static fallbacks for non-JS social crawlers remain in index.html.
 */
const PageMeta = ({ title, description, path, ogType = "website" }: PageMetaProps) => {
  const url = `${ORIGIN}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:url" content={url} />
    </Helmet>
  );
};

export default PageMeta;
