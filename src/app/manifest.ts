import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nourish — diet tracker",
    short_name: "Nourish",
    description: "Track what you eat, hit your calorie and protein goals.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f5f6f2",
    theme_color: "#0b8457",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
