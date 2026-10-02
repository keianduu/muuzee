export function isExhibitionPublicationAction(action: unknown): action is "publish" | "unpublish" {
  return action === "publish" || action === "unpublish";
}
