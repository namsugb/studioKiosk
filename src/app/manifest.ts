import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "스튜디오 현장 접수", short_name: "스튜디오 접수", description: "사진관 고객 접수 키오스크", start_url: "/kiosk", display: "standalone", background_color: "#ffffff", theme_color: "#ffffff", orientation: "any", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}

