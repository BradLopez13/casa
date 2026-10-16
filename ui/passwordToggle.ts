export function passwordToggle(visible: boolean): {
  icon: 'eye-outline' | 'eye-off-outline';
  labelKey: 'auth.password.show' | 'auth.password.hide';
} {
  return visible
    ? { icon: 'eye-off-outline', labelKey: 'auth.password.hide' }
    : { icon: 'eye-outline', labelKey: 'auth.password.show' };
}
