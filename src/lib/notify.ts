export function turnNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function requestNotifyPermission(): void {
  if (!turnNotificationSupported() || Notification.permission !== 'default') return
  void Notification.requestPermission()
}

export function shouldNotifyTurn(prevTurnOf: number | null, nextTurnOf: number, me: number, over: boolean): boolean {
  return !over && nextTurnOf === me && prevTurnOf !== null && prevTurnOf !== nextTurnOf
}

export function showTurnNotification(): void {
  const notification = new Notification('Hanabi', { body: "It's your turn!", tag: 'hanabi-turn' })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
