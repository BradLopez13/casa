export const membershipKey = ['membership'] as const;
/** Every household the person is in (bloque 12); `membershipKey` is the active one. */
export const householdsKey = ['households'] as const;
export const membersKey = (householdId: string | undefined) => ['members', householdId] as const;
export const invitesKey = (householdId: string | undefined) => ['invites', householdId] as const;
export const licenseKey = (householdId: string | undefined) => ['license', householdId] as const;
