import * as React from "react"

export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {}
      const result = window.matchMedia(query)
      result.addEventListener("change", onStoreChange)
      return () => result.removeEventListener("change", onStoreChange)
    },
    [query]
  )

  const getSnapshot = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false

  const getServerSnapshot = () => false

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
