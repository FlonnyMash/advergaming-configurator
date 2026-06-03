export function textureKeyForTargetPath(targetPath: string): string | null {
  if (targetPath === "catchGame.assets.player") return "player";
  if (targetPath === "catchGame.assets.ground.image") return "ground";

  const good = /^catchGame\.assets\.goodItems\.(\d+)\.image$/.exec(targetPath);
  if (good) return `item-good-${good[1]}`;

  const bad = /^catchGame\.assets\.badItems\.(\d+)\.image$/.exec(targetPath);
  if (bad) return `item-bad-${bad[1]}`;

  if (targetPath === "theme.playerTexture") return "player-custom";

  return null;
}
