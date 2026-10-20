export const EXHIBITION_REFRESH_FAILED_MESSAGE = "保存は完了しましたが、最新状態の取得に失敗しました。";

export async function completeExhibitionMutation(options: {
  applyImmediate?: () => void;
  refreshDetail: () => Promise<void>;
  notifyList: () => void;
}) {
  options.applyImmediate?.();
  await options.refreshDetail();
  options.notifyList();
}
