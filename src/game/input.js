import { runtime } from './runtime'
import { useGame } from './store'

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  Space: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyE: 'board',
  KeyB: 'board',
  KeyQ: 'jet',
}

export const pushAction = (a) => {
  if (runtime.mode !== 'playing' || runtime.crashed) return
  // keep the queue short so mashing never builds a backlog
  if (runtime.actions.length < 3) runtime.actions.push(a)
}

/** Installs global keyboard + swipe listeners. Returns a cleanup function. */
export function installInput(target = window) {
  const onKeyDown = (e) => {
    const state = useGame.getState()
    const active = document.activeElement
    const onButton = active && active.tagName === 'BUTTON'
    // never let Space/Enter "click" a focused button while running
    if (state.phase === 'playing' && onButton) active.blur()
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state.phase === 'playing') state.pause()
      else if (state.phase === 'paused') state.resume()
      else if (state.phase === 'menu' && state.screen !== 'home' && e.code === 'Escape') state.openScreen('home')
      return
    }
    if (e.code === 'Enter') {
      if (onButton && state.phase !== 'playing') return // the focused button handles it
      if ((state.phase === 'menu' && state.screen === 'home') || state.phase === 'gameover') state.startGame()
      else if (state.phase === 'intro') state.finishIntro()
      return
    }
    const action = KEYMAP[e.code]
    if (!action) return
    if (state.phase === 'playing') e.preventDefault()
    if (e.repeat) return
    pushAction(action)
  }

  // --- swipe gestures
  let sx = 0
  let sy = 0
  let tracking = false
  const THRESHOLD = 28

  let lastTap = 0
  let moved = false
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return
    sx = e.touches[0].clientX
    sy = e.touches[0].clientY
    tracking = true
    moved = false
  }
  const onTouchMove = (e) => {
    if (!tracking) return
    const dx = e.touches[0].clientX - sx
    const dy = e.touches[0].clientY - sy
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return
    tracking = false // fire once per gesture, as early as possible
    moved = true
    if (Math.abs(dx) > Math.abs(dy)) pushAction(dx > 0 ? 'right' : 'left')
    else pushAction(dy > 0 ? 'down' : 'up')
  }
  const onTouchEnd = (e) => {
    tracking = false
    // double-tap anywhere on the play field rides a skateboard
    if (!moved && e.target?.tagName !== 'BUTTON' && !e.target?.closest?.('button')) {
      const now = performance.now()
      if (now - lastTap < 300) {
        pushAction('board')
        lastTap = 0
      } else lastTap = now
    }
  }

  window.addEventListener('keydown', onKeyDown)
  target.addEventListener('touchstart', onTouchStart, { passive: true })
  target.addEventListener('touchmove', onTouchMove, { passive: true })
  target.addEventListener('touchend', onTouchEnd, { passive: true })
  target.addEventListener('touchcancel', onTouchEnd, { passive: true })

  // auto-pause when the tab loses focus
  const onVisibility = () => {
    if (document.hidden) useGame.getState().pause()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchmove', onTouchMove)
    target.removeEventListener('touchend', onTouchEnd)
    target.removeEventListener('touchcancel', onTouchEnd)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
