export function isAllowedUser(
  userId: number | undefined,
  allowedTelegramUserIds: ReadonlySet<number>
): boolean {
  return typeof userId === "number" && allowedTelegramUserIds.has(userId);
}
