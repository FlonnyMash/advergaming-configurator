import { getPrimaryBrandColor, type GameMasterConfig } from "@mashedgames/shared";
import Phaser from "phaser";
import { reloadBase64Texture } from "../../../game/reloadBase64Texture.ts";
import type { TemplateScene } from "../../types.ts";

export const DICE_POKER_SCENE_KEY = "DicePoker";

const DEFAULT_BOX_KEY = "defaultBox";
const CUSTOM_PLAYER_KEY = "customPlayer";
const PLAYER_DISPLAY_SIZE = 100;

let gameStartPending = false;

if (typeof window !== "undefined") {
  window.addEventListener("GAME_START", () => {
    gameStartPending = true;
  });
}

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class DicePokerScene extends Phaser.Scene implements TemplateScene {
  playerSprite!: Phaser.GameObjects.Sprite;
  isPlaying = false;

  private currentSpeed = 200;
  private lastPlayerTexture: string | null = null;
  private readonly onGameStart = (): void => {
    this.start();
  };

  constructor() {
    super({ key: DICE_POKER_SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;

    if (!this.textures.exists(DEFAULT_BOX_KEY)) {
      const canvas = this.textures.createCanvas(DEFAULT_BOX_KEY, 50, 50);
      if (canvas) {
        canvas.context.fillStyle = "#ffffff";
        canvas.context.fillRect(0, 0, 50, 50);
        canvas.refresh();
      }
    }

    this.playerSprite = this.add.sprite(width / 2, height / 2, DEFAULT_BOX_KEY);
    this.playerSprite.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);

    window.addEventListener("GAME_START", this.onGameStart);

    if (gameStartPending) {
      gameStartPending = false;
      this.start();
    }
  }

  shutdown(): void {
    window.removeEventListener("GAME_START", this.onGameStart);
  }

  start(): void {
    this.isPlaying = true;
  }

  update(_time: number, delta: number): void {
    if (!this.isPlaying) return;

    const { width } = this.scale;
    const step = this.currentSpeed * (delta / 1000);
    this.playerSprite.x += step;

    const halfWidth = this.playerSprite.displayWidth / 2;
    if (this.playerSprite.x > width + halfWidth) {
      this.playerSprite.x = -halfWidth;
    }
  }

  updateConfig(payload: GameMasterConfig): void {
    this.currentSpeed = payload.system.mechanics.playerSpeed;
    this.cameras.main.setBackgroundColor(
      hexToPhaserColor(getPrimaryBrandColor(payload)),
    );

    const playerTexture = payload.branding.theme.playerTexture;
    if (playerTexture === this.lastPlayerTexture) return;
    this.lastPlayerTexture = playerTexture;

    reloadBase64Texture({
      scene: this,
      textureKey: CUSTOM_PLAYER_KEY,
      dataUrl: playerTexture,
      fallbackTextureKey: DEFAULT_BOX_KEY,
      onApplied: (textureKey) => {
        this.playerSprite.setTexture(textureKey);
        this.playerSprite.setDisplaySize(
          PLAYER_DISPLAY_SIZE,
          PLAYER_DISPLAY_SIZE,
        );
        this.playerSprite.setVisible(true);
      },
    });
  }
}
