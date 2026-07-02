// pusher-js ships no consumable .d.ts for its main client bundle (only
// internal websocket-polyfill types), and the published @types/pusher-js
// is stuck on the old v5 API (missing `channelAuthorization`, added in v7+).
// Minimal ambient declaration scoped to exactly what lib/pusher-browser.ts uses.
declare module "pusher-js" {
  interface PusherChannel {
    bind(eventName: string, callback: (data: unknown) => void): void;
    unbind_all(): void;
  }

  interface PusherOptions {
    channelAuthorization?: {
      endpoint: string;
      transport: "ajax" | "jsonp";
      /** Extra fields sent alongside socket_id/channel_name (form-urlencoded POST body). */
      params?: Record<string, string>;
    };
    cluster: string;
  }

  export default class Pusher {
    constructor(appKey: string, options: PusherOptions);
    subscribe(channelName: string): PusherChannel;
    unsubscribe(channelName: string): void;
    disconnect(): void;
  }
}
