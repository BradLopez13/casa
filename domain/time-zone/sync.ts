/** Whether the profile's stored time zone should be replaced by the phone's. */
export function shouldSyncTimeZone(
  profileTz: string | null,
  deviceTz: string | null | undefined,
): boolean {
  if (!deviceTz) return false;
  return profileTz !== deviceTz;
}
