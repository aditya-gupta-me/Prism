import { ImageResponse } from "next/og";

export const alt = "Prism — Browser-Native Cloud IDE";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          padding: "80px",
          color: "#fafafa",
        }}
      >
        {/* Top Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              backgroundColor: "#18181b",
              border: "2px solid #27272a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "42px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#ffffff",
            }}
          >
            Prism
          </span>
        </div>

        {/* Main Pitch */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: "#f4f4f5",
            }}
          >
            Browser-Native Cloud IDE
          </div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 400,
              color: "#a1a1aa",
              lineHeight: 1.4,
            }}
          >
            Write, preview, and run full-stack Node.js applications in your browser with real-time AI assistance and zero local setup.
          </div>
        </div>

        {/* Feature Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {[
            "Node.js WebContainers",
            "AI Coding Agent",
            "CodeMirror 6",
            "Live Preview",
            "GitHub Sync",
          ].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "10px 20px",
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "9999px",
                fontSize: "18px",
                fontWeight: 500,
                color: "#e4e4e7",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
