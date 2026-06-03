import { z } from "zod";

export const LoadExternalAssetPayloadSchema = z.object({
  key: z.string().min(1),
  absolutePath: z.string().min(1),
});

export const AssetReadyPayloadSchema = z.object({
  key: z.string().min(1),
});

export const SetRuntimeAssetsPayloadSchema = z.object({
  assets: z.record(z.string(), z.string()),
});

export type LoadExternalAssetPayload = z.infer<
  typeof LoadExternalAssetPayloadSchema
>;
export type AssetReadyPayload = z.infer<typeof AssetReadyPayloadSchema>;
export type SetRuntimeAssetsPayload = z.infer<
  typeof SetRuntimeAssetsPayloadSchema
>;
