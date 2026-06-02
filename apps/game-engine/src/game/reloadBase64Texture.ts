import type Phaser from "phaser";

export interface ReloadBase64TextureOptions {
  scene: Phaser.Scene;
  textureKey: string;
  dataUrl: string | null;
  fallbackTextureKey: string;
  onApplied: (textureKey: string) => void;
}

/**
 * Removes a prior Base64 texture from the Phaser cache before loading a new one
 * to avoid memory leaks on repeated uploads.
 */
export function reloadBase64Texture({
  scene,
  textureKey,
  dataUrl,
  fallbackTextureKey,
  onApplied,
}: ReloadBase64TextureOptions): void {
  const removeCustom = () => {
    if (scene.textures.exists(textureKey)) {
      scene.textures.remove(textureKey);
    }
  };

  if (!dataUrl) {
    removeCustom();
    onApplied(fallbackTextureKey);
    return;
  }

  removeCustom();

  scene.textures.once("addtexture", (key: string) => {
    if (key === textureKey) {
      onApplied(textureKey);
    }
  });

  scene.textures.addBase64(textureKey, dataUrl);
}
