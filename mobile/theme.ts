// theme.ts
import { vars } from "nativewind";

// ============================================================================
// FONT CONFIGURATION
// ============================================================================
// Each theme can define its own font families. Fonts are loaded in _layout.tsx
// using expo-font and referenced via CSS variables in tailwind.config.js.

export interface ThemeFonts {
  heading: {
    family: string;
    weights: Record<string, string>; // weight name -> font file key
  };
  body: {
    family: string;
    weights: Record<string, string>;
  };
  mono: {
    family: string;
    weights: Record<string, string>;
  };
}

export const themeFonts: ThemeFonts = {
  heading: {
    family: "System",
    weights: {
      normal: "System",
      bold: "System",
    },
  },
  body: {
    family: "System",
    weights: {
      normal: "System",
      bold: "System",
    },
  },
  mono: {
    family: "System",
    weights: {
      normal: "System",
      bold: "System",
    },
  },
};

export const lightTheme = vars({
  "--radius": "14", // 0.875rem = 14px

  // Core semantic colors — warm ivory canvas, deep petrol ink
  "--background": "244 242 236",
  "--foreground": "27 40 46",

  "--card": "255 255 255",
  "--card-foreground": "27 40 46",

  "--popover": "255 255 255",
  "--popover-foreground": "27 40 46",

  "--primary": "18 102 122", // deep teal
  "--primary-foreground": "255 255 255",

  "--secondary": "232 239 238",
  "--secondary-foreground": "18 102 122",

  "--muted": "236 234 226",
  "--muted-foreground": "112 121 122",

  "--accent": "245 164 66", // warm amber
  "--accent-foreground": "27 40 46",

  "--destructive": "220 68 68",

  "--border": "226 222 212",
  "--input": "226 222 212",
  "--ring": "18 102 122",

  // Chart colors — amber-led with teal/sage neighbors
  "--chart-1": "245 164 66",
  "--chart-2": "18 102 122",
  "--chart-3": "74 150 130",
  "--chart-4": "214 88 66",
  "--chart-5": "190 168 120",

  // Sidebar colors
  "--sidebar": "236 234 226",
  "--sidebar-foreground": "27 40 46",
  "--sidebar-primary": "18 102 122",
  "--sidebar-primary-foreground": "255 255 255",
  "--sidebar-accent": "232 239 238",
  "--sidebar-accent-foreground": "18 102 122",
  "--sidebar-border": "226 222 212",
  "--sidebar-ring": "18 102 122",
});

export const darkTheme = vars({
  "--radius": "14",

  // Core semantic colors — deep petrol night, warm amber highlight
  "--background": "14 24 29",
  "--foreground": "234 238 234",

  "--card": "22 35 40",
  "--card-foreground": "234 238 234",

  "--popover": "27 42 48",
  "--popover-foreground": "234 238 234",

  "--primary": "245 164 66", // amber pops on petrol
  "--primary-foreground": "20 28 32",

  "--secondary": "28 48 54",
  "--secondary-foreground": "234 238 234",

  "--muted": "26 44 50",
  "--muted-foreground": "141 157 158",

  "--accent": "67 178 172",
  "--accent-foreground": "14 24 29",

  "--destructive": "239 88 88",

  "--border": "36 56 62",
  "--input": "36 56 62",
  "--ring": "245 164 66",

  // Chart colors
  "--chart-1": "245 164 66",
  "--chart-2": "67 178 172",
  "--chart-3": "92 160 150",
  "--chart-4": "224 109 90",
  "--chart-5": "190 168 120",

  // Sidebar colors
  "--sidebar": "16 27 32",
  "--sidebar-foreground": "234 238 234",
  "--sidebar-primary": "245 164 66",
  "--sidebar-primary-foreground": "20 28 32",
  "--sidebar-accent": "28 48 54",
  "--sidebar-accent-foreground": "234 238 234",
  "--sidebar-border": "36 56 62",
  "--sidebar-ring": "245 164 66",
});
