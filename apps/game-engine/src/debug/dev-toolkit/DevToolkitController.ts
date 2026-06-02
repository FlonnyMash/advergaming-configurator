import type { DevToolkitFlags } from "@advergaming/shared";
import { DEFAULT_DEV_TOOLKIT_FLAGS } from "@advergaming/shared";
import type { DebugOverlay } from "../DebugOverlay.ts";
import type { GameFreezeController } from "../GameFreezeController.ts";

export class DevToolkitController {
  private flags: DevToolkitFlags = { ...DEFAULT_DEV_TOOLKIT_FLAGS };
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
    private readonly overlay: DebugOverlay,
    private readonly freeze: GameFreezeController,
    private readonly notifyState: () => void,
  ) {
    freeze.game.events.on("debugFreezeChanged", this.onFreezeChanged);
    this.notifyState();
  }

  getState(): DevToolkitFlags {
    return {
      ...this.overlay.getFlags(),
      freeze: this.freeze.isFrozen(),
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

    this.flags = this.getState();
    this.notifyState();
  }

  reset(): void {
    this.applyFlags(DEFAULT_DEV_TOOLKIT_FLAGS);
  }

  destroy(): void {
    this.freeze.game.events.off("debugFreezeChanged", this.onFreezeChanged);
    this.reset();
  }
}
