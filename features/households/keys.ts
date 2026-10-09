export const membershipKey = ['membership'] as const;
export const membersKey = (householdId: string | undefined) => ['members', householdId] as const;
export const invitesKey = (householdId: string | undefined) => ['invites', householdId] as const;
