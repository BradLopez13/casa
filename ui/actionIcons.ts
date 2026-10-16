// Pure: the Ionicons glyph for each action. Button checks the names against Ionicons' own type.
export const actionIcons = {
  logIn: 'log-in-outline',
  signUp: 'person-add-outline',
  confirm: 'checkmark',
  sendCode: 'mail-outline',
  changeEmail: 'mail-outline',
  resend: 'refresh-outline',
  retry: 'refresh-outline',
  saveAndEnter: 'key-outline',
  home: 'home-outline',
  join: 'link-outline',
  invite: 'share-social-outline',
  copyLink: 'copy-outline',
  makeOwner: 'swap-horizontal-outline',
  removeMember: 'person-remove-outline',
  revoke: 'close-circle-outline',
  signOut: 'log-out-outline',
  delete: 'trash-outline',
  back: 'arrow-back',
  close: 'close',
  add: 'add',
  openPhoneSettings: 'settings-outline',
} as const;

export type ActionIcon = (typeof actionIcons)[keyof typeof actionIcons];
