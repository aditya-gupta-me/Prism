import { HomeView } from "@/features/home/components/home-view";
import { getSiteUrl } from "@/lib/site-url";

export default function Home() {
  const siteUrl = getSiteUrl().origin;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Prism",
    url: siteUrl,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (Modern Web Browser)",
    description:
      "Browser-native cloud IDE for full-stack web development with in-browser Node.js runtime and AI coding assistance.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "In-browser Node.js runtime powered by WebContainers",
      "Multi-tab code editor with CodeMirror 6",
      "AI-powered inline completions and autonomous coding agent",
      "Live dev server preview and terminal",
      "Bi-directional GitHub repository import and export",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeView />
    </>
  );
}
