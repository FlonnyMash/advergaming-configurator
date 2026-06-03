import type {
  DevToolkitFlags,
  DevToolkitPickedAsset,
  DevToolkitSetFlagsPayload,
} from "@mashedgames/shared";

export const DEV_TOOLKIT_SYNC_CHANNEL = "mashedgames-dev-toolkit";

export type DevToolkitSyncMessage =
  | { type: "state"; flags: DevToolkitFlags }
  | { type: "setFlags"; patch: DevToolkitSetFlagsPayload }
  | { type: "asset"; asset: DevToolkitPickedAsset };

type DevToolkitSyncEnvelope = DevToolkitSyncMessage & {
  sourceId: string;
};

const syncSourceId =
  typeof window !== "undefined"
    ? `dash-${Math.random().toString(36).slice(2)}`
    : "server";

export function publishDevToolkitSync(message: DevToolkitSyncMessage): void {
  if (typeof BroadcastChannel === "undefined") {
    return;
  }

  const channel = new BroadcastChannel(DEV_TOOLKIT_SYNC_CHANNEL);
  const envelope: DevToolkitSyncEnvelope = { ...message, sourceId: syncSourceId };
  channel.postMessage(envelope);
  channel.close();
}

export function subscribeDevToolkitSync(
  listener: (message: DevToolkitSyncMessage) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }

  const channel = new BroadcastChannel(DEV_TOOLKIT_SYNC_CHANNEL);
  channel.onmessage = (event: MessageEvent<DevToolkitSyncEnvelope>) => {
    const envelope = event.data;
    if (!envelope || envelope.sourceId === syncSourceId) {
      return;
    }

    const { sourceId: _sourceId, ...message } = envelope;
    listener(message);
  };

  return () => {
    channel.close();
  };
}

export const DEV_TOOLS_POPOUT_PATH = "/studio/dev-tools";
export const DEV_TOOLS_POPOUT_NAME = "mashedgames-dev-tools";

export function openDevToolsPopout(): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.open(
    DEV_TOOLS_POPOUT_PATH,
    DEV_TOOLS_POPOUT_NAME,
    "width=440,height=820,menubar=no,toolbar=no,location=no,status=no",
  );
}
