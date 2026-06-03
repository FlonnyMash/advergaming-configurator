import { z } from "zod";

export const PlatformFeaturesSchema = z.object({
  enableLeadGen: z.boolean(),
  enableCustomCSS: z.boolean(),
  maxTemplates: z.number().int().min(0),
});

export const PlatformConfigSchema = z.object({
  appName: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logoPath: z.string().min(1),
  features: PlatformFeaturesSchema,
});

export type PlatformFeatures = z.infer<typeof PlatformFeaturesSchema>;
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

export const APP_DISPLAY_NAME = "Mashed Games Studio";

/** Public URL — file lives at apps/dashboard/public/mashed-games-logo.png */
export const BRAND_LOGO_URL_PATH = "/mashed-games-logo.png" as const;

export const BRAND_LOGO_FILENAME = "mashed-games-logo.png" as const;

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  appName: APP_DISPLAY_NAME,
  primaryColor: "#4f46e5",
  logoPath: BRAND_LOGO_URL_PATH,
  features: {
    enableLeadGen: false,
    enableCustomCSS: true,
    maxTemplates: 10,
  },
};

export function parsePlatformConfig(data: unknown): PlatformConfig | null {
  const result = PlatformConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}
