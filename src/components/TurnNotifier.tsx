import { useEffect, useRef } from 'react'
import { shouldNotifyTurn, showTurnNotification, turnNotificationSupported } from '../lib/notify'
import { useGame } from '../store/GameContext'

export function TurnNotifier() {
  const { view, simulating } = useGame()
  const prevTurnOfRef = useRef<number | null>(null)

  useEffect(() => {
    if (!view || simulating) return
    const turnOf = view.turnOf
    const prev = prevTurnOfRef.current
    prevTurnOfRef.current = turnOf
    if (!turnNotificationSupported() || Notification.permission !== 'granted' || !document.hidden) return
    if (shouldNotifyTurn(prev, turnOf, view.me, view.over !== null)) {
      showTurnNotification()
    }
  }, [view, simulating])

  return null
}
