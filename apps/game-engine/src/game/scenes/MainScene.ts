import type { GameplayConfig, ThemeConfig } from "@advergaming/shared";
import Phaser from "phaser";

export const MAIN_SCENE_KEY = "Main";

const CUSTOM_PLAYER_KEY = "customPlayer";
const DEFAULT_PLAYER_TEXTURE = "__WHITE";
const PLAYER_DISPLAY_WIDTH = 48;
const PLAYER_DISPLAY_HEIGHT = 32;

let gameStartPending = false;

if (typeof window !== "undefined") {
  window.addEventListener("GAME_START", () => {
    gameStartPending = true;
  });
}

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class MainScene extends Phaser.Scene {
  playerSprite!: Phaser.GameObjects.Sprite;
  isPlaying = false;

  private currentSpeed = 200;
  private lastPlayerTexture: string | null = null;
  private readonly onGameStart = (): void => {
    this.start();
  };

  constructor() {
    super({ key: MAIN_SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    this.playerSprite = this.add.sprite(
      width / 2,
      height / 2,
      DEFAULT_PLAYER_TEXTURE,
    );
    this.playerSprite.setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_HEIGHT);

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

  updateConfig(config: GameplayConfig): void {
    this.currentSpeed = config.playerSpeed;
  }

  updateTheme(theme: ThemeConfig): void {
    this.cameras.main.setBackgroundColor(hexToPhaserColor(theme.primaryColor));

    if (theme.playerTexture === this.lastPlayerTexture) return;

    this.lastPlayerTexture = theme.playerTexture;

    if (theme.playerTexture === null) {
      this.removeCustomPlayerTexture();
      this.playerSprite.setTexture(DEFAULT_PLAYER_TEXTURE);
      this.playerSprite.setDisplaySize(
        PLAYER_DISPLAY_WIDTH,
        PLAYER_DISPLAY_HEIGHT,
      );
      this.playerSprite.setVisible(true);
      return;
    }

    this.removeCustomPlayerTexture();

    this.textures.once(
      Phaser.Textures.Events.ADD,
      (_texture: Phaser.Textures.Texture, key: string) => {
        if (key !== CUSTOM_PLAYER_KEY) return;
        this.playerSprite.setTexture(CUSTOM_PLAYER_KEY);
        this.playerSprite.setDisplaySize(
          PLAYER_DISPLAY_WIDTH,
          PLAYER_DISPLAY_HEIGHT,
        );
        this.playerSprite.setVisible(true);
      },
    );

    try {
      this.textures.addBase64(CUSTOM_PLAYER_KEY, theme.playerTexture);
    } catch {
      this.playerSprite.setTexture(DEFAULT_PLAYER_TEXTURE);
      this.playerSprite.setVisible(true);
    }
  }

  private removeCustomPlayerTexture(): void {
    if (this.textures.exists(CUSTOM_PLAYER_KEY)) {
      this.textures.remove(CUSTOM_PLAYER_KEY);
    }
  }
}
