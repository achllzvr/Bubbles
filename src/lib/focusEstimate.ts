/** Classic pomodoro work block — the only work length. */
export const POMODORO_WORK_MINUTES = 25
export const SHORT_BREAK_MINUTES = 5
export const LONG_BREAK_MINUTES = 15

export function focusLabel(_minutes?: number): string {
  return 'Pomodoro'
}

export function breakLabel(minutes: number): string {
  return minutes >= LONG_BREAK_MINUTES ? 'Long break' : 'Short break'
}

/** @deprecated Work is always 25m — kept for call-site compatibility. */
export function estimateFocusMinutes(_title?: string, _hasSubtasks?: boolean): number {
  return POMODORO_WORK_MINUTES
}

/** @deprecated Work is always 25m. */
export function snapWorkMinutes(_n?: number): number {
  return POMODORO_WORK_MINUTES
}

/** Sub-steps are checklist items, not timed bubbles. */
export function minutesForSubtask(_label?: string, _parentMinutes?: number): undefined {
  return undefined
}
