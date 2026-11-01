let choice: boolean | undefined;
export function storedMotionOff() {
  try {
    return localStorage.getItem('rfb-motion') === 'off';
  } catch {
    return choice ?? true;
  }
}
export function setMotionOff(value: boolean) {
  choice = value;
  try {
    localStorage.setItem('rfb-motion', value ? 'off' : 'on');
  } catch {
    /* This tab still respects the visitor's choice. */
  }
  window.dispatchEvent(new Event('rfb-motion'));
}
