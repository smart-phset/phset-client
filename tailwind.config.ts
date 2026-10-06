import type { Config } from "tailwindcss";

// Design tokens exported from Google Stitch ("Calm Field Instrument"), unchanged.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    "extend": {
      "colors": {
        "on-surface-variant": "#434653",
        "on-secondary-container": "#725600",
        "on-primary-container": "#a9c1ff",
        "on-primary-fixed": "#001945",
        "outline": "#737784",
        "on-tertiary-fixed-variant": "#005228",
        "on-primary": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e0e9f9",
        "surface-container-highest": "#dae3f4",
        "tertiary": "#00421f",
        "primary": "#00357f",
        "tertiary-fixed": "#a1f5b5",
        "secondary": "#775a00",
        "on-secondary-fixed": "#251a00",
        "tertiary-fixed-dim": "#86d89b",
        "on-secondary-fixed-variant": "#5a4300",
        "on-error": "#ffffff",
        "on-background": "#131c28",
        "surface": "#f8f9ff",
        "tertiary-container": "#005c2e",
        "primary-fixed-dim": "#b0c6ff",
        "surface-bright": "#f8f9ff",
        "outline-variant": "#c3c6d5",
        "on-error-container": "#93000a",
        "inverse-surface": "#28313d",
        "error": "#ba1a1a",
        "surface-container": "#e5eeff",
        "on-secondary": "#ffffff",
        "on-primary-fixed-variant": "#00429b",
        "on-surface": "#131c28",
        "on-tertiary": "#ffffff",
        "secondary-fixed": "#ffdf99",
        "secondary-container": "#ffca42",
        "error-container": "#ffdad6",
        "surface-tint": "#215abd",
        "inverse-primary": "#b0c6ff",
        "surface-container-low": "#eff4ff",
        "on-tertiary-container": "#81d396",
        "secondary-fixed-dim": "#f3bf37",
        "primary-container": "#004aad",
        "surface-variant": "#dae3f4",
        "surface-dim": "#d2daeb",
        "on-tertiary-fixed": "#00210d",
        "background": "#f8f9ff",
        "primary-fixed": "#d9e2ff",
        "inverse-on-surface": "#eaf1ff"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-sm": "0.5rem",
        "gutter": "1rem",
        "space-xs": "0.25rem",
        "space-xl": "2rem",
        "margin": "1rem"
      },
      "fontFamily": {
        "headline-hero-mobile": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "label-sm": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "label-md": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "unit-hero": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "body-md": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "headline-hero": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "body-lg": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "headline-sm": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "Kantumruy Pro", "sans-serif"]
      },
      "fontSize": {
        "headline-hero-mobile": [
          "44px",
          {
            "lineHeight": "48px",
            "letterSpacing": "-0.02em",
            "fontWeight": "600"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.04em",
            "fontWeight": "600"
          }
        ],
        "label-md": [
          "13px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.02em",
            "fontWeight": "600"
          }
        ],
        "unit-hero": [
          "22px",
          {
            "lineHeight": "28px",
            "fontWeight": "500"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "headline-hero": [
          "56px",
          {
            "lineHeight": "60px",
            "letterSpacing": "-0.02em",
            "fontWeight": "600"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "24px",
            "fontWeight": "400"
          }
        ],
        "headline-sm": [
          "18px",
          {
            "lineHeight": "24px",
            "fontWeight": "600"
          }
        ],
        "headline-lg": [
          "28px",
          {
            "lineHeight": "36px",
            "letterSpacing": "-0.01em",
            "fontWeight": "600"
          }
        ],
        "headline-md": [
          "22px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ]
      }
    }
  },
  plugins: [],
};

export default config;
