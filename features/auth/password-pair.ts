export type PairState = { passwordTouched: boolean; confirmTouched: boolean; submitted: boolean };
export type PairEvent = 'blurPassword' | 'blurConfirm' | 'submit';

type Values = { password: string; confirm: string };
type PairErrors = {
  password?: 'passwordTooShort';
  confirm?: 'passwordConfirmRequired' | 'passwordMismatch';
};

const MIN_LENGTH = 8;

export function nextPairState(s: PairState, e: PairEvent): PairState {
  switch (e) {
    case 'blurPassword':
      return { ...s, passwordTouched: true };
    case 'blurConfirm':
      return { ...s, confirmTouched: true };
    case 'submit':
      return { ...s, submitted: true };
  }
}

/** Errors to show now; nothing is validated per keystroke before the first blur. */
export function pairErrors(s: PairState, v: Values): PairErrors {
  const out: PairErrors = {};
  if ((s.passwordTouched || s.submitted) && v.password.length < MIN_LENGTH) {
    out.password = 'passwordTooShort';
  }
  if (s.confirmTouched || s.submitted) {
    if (v.confirm === '') out.confirm = 'passwordConfirmRequired';
    else if (v.confirm !== v.password) out.confirm = 'passwordMismatch';
  }
  return out;
}

export function pairMatches(v: Values): boolean {
  return v.password.length >= MIN_LENGTH && v.password === v.confirm;
}
