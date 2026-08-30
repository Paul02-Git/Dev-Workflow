import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Deferred via queueMicrotask, not called synchronously in the effect
    // body — this repo's react-hooks/set-state-in-effect rule flags a
    // *synchronous* setState call directly in an effect (the listener's
    // own setState above is fine, since that only runs from its event
    // callback, not the effect body itself).
    queueMicrotask(() => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT))
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
