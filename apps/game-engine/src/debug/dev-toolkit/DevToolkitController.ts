import type { DevToolkitFlags } from "@mashedgames/shared";
import { DEFAULT_DEV_TOOLKIT_FLAGS } from "@mashedgames/shared";
import type { AssetPickerController } from "./AssetPickerController.ts";
import type { DebugOverlay } from "../DebugOverlay.ts";
import type { GameFreezeController } from "../GameFreezeController.ts";

export class DevToolkitController {
  private flags: DevToolkitFlags = { ...DEFAULT_DEV_TOOLKIT_FLAGS };
  private readonly overlay: DebugOverlay;
  private readonly freeze: GameFreezeController;
  private readonly assetPicker: AssetPickerController;
  private readonly notifyState: () => void;
  private readonly onFreezeChanged = (payload: { frozen?: boolean }) => {
    if (typeof payload?.frozen !== "boolean") {
      return;
    }
    if (this.flags.freeze === payload.frozen) {
      return;
    }
    this.flags.freeze = payload.frozen;
    this.notifyState();
  };

  constructor(
    overlay: DebugOverlay,
    freeze: GameFreezeController,
    assetPicker: AssetPickerController,
    notifyState: () => void,
  ) {
    this.overlay = overlay;
    this.freeze = freeze;
    this.assetPicker = assetPicker;
    this.notifyState = notifyState;
    freeze.game.events.on("debugFreezeChanged", this.onFreezeChanged);
    this.notifyState();
  }

  getState(): DevToolkitFlags {
    return {
      ...this.overlay.getFlags(),
      freeze: this.freeze.isFrozen(),
      assetPicker: this.flags.assetPicker,
    };
  }

  applyFlags(partial: Partial<DevToolkitFlags>): void {
    const overlayPatch: Partial<
      Pick<DevToolkitFlags, "hitboxes" | "origins" | "pivots" | "physicsDebug">
    > = {};

    if (typeof partial.hitboxes === "boolean") {
      overlayPatch.hitboxes = partial.hitboxes;
    }
    if (typeof partial.origins === "boolean") {
      overlayPatch.origins = partial.origins;
    }
    if (typeof partial.pivots === "boolean") {
      overlayPatch.pivots = partial.pivots;
    }
    if (typeof partial.physicsDebug === "boolean") {
      overlayPatch.physicsDebug = partial.physicsDebug;
    }

    if (Object.keys(overlayPatch).length > 0) {
      this.overlay.setFlags(overlayPatch);
    }

    if (typeof partial.freeze === "boolean") {
      this.freeze.setFrozen(partial.freeze);
    }

    if (typeof partial.assetPicker === "boolean") {
      this.flags.assetPicker = partial.assetPicker;
      this.assetPicker.setEnabled(partial.assetPicker);
      if (partial.assetPicker && !this.freeze.isFrozen()) {
        this.freeze.setFrozen(true);
      }
    }

    this.flags = this.getState();
    this.notifyState();
  }

  reset(): void {
    this.applyFlags(DEFAULT_DEV_TOOLKIT_FLAGS);
  }

  destroy(): void {
    this.freeze.game.events.off("debugFreezeChanged", this.onFreezeChanged);
    this.assetPicker.destroy();
    this.reset();
  }
}
