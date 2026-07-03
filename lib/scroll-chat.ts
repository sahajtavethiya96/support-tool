export const CHAT_BOTTOM_MARKER_ID = "chat-bottom-marker";

/** Scrolls the page to the `ScrollToBottomOnMount` marker, if one is mounted. */
export function scrollChatToBottom(smooth = true) {
  document
    .getElementById(CHAT_BOTTOM_MARKER_ID)
    ?.scrollIntoView({ block: "end", behavior: smooth ? "smooth" : "auto" });
}
