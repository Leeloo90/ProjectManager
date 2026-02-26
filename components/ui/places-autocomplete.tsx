'use client'
import { useEffect, useRef } from 'react'

export function PlacesAutocomplete({
  name,
  defaultValue,
  placeholder,
  className,
  onSelect,
  onChange,
}: {
  name?: string
  defaultValue?: string
  placeholder?: string
  className?: string
  onSelect?: (address: string) => void
  onChange?: (value: string) => void
}) {
  const newApiWrapperRef = useRef<HTMLDivElement>(null)
  const legacyInputRef = useRef<HTMLInputElement>(null)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect })

  useEffect(() => {
    let cleanup: (() => void) | undefined

    function tryInit(): boolean {
      const g = (window as any).google
      if (!g?.maps?.places) return false

      // Prefer old Autocomplete — uses our styled input, fires onChange on every keystroke,
      // works with any key that has "Places API" enabled (the standard one)
      if (g.maps.places.Autocomplete && legacyInputRef.current) {
        try {
          const ac = new g.maps.places.Autocomplete(legacyInputRef.current, { types: ['geocode'] })
          const listener = g.maps.event.addListener(ac, 'place_changed', () => {
            const address: string | undefined = ac.getPlace()?.formatted_address
            if (address) {
              if (legacyInputRef.current) legacyInputRef.current.value = address
              if (hiddenInputRef.current) hiddenInputRef.current.value = address
              onSelectRef.current?.(address)
            }
          })
          cleanup = () => g.maps.event.removeListener(listener)
          return true
        } catch { /* fall through to new API */ }
      }

      // Fallback: new PlaceAutocompleteElement (required for API keys created after March 2025)
      if (g.maps.places.PlaceAutocompleteElement && newApiWrapperRef.current) {
        try {
          if (newApiWrapperRef.current.children.length > 0) return true
          const element = new g.maps.places.PlaceAutocompleteElement({ types: ['geocode'] })
          newApiWrapperRef.current.style.display = 'block'
          newApiWrapperRef.current.appendChild(element)
          if (legacyInputRef.current) legacyInputRef.current.style.display = 'none'

          // Capture typing so the Calculate button stays enabled
          element.addEventListener('input', (event: Event) => {
            const path = (event as any).composedPath?.() as HTMLInputElement[] | undefined
            const value = path?.[0]?.value ?? ''
            if (value) {
              if (hiddenInputRef.current) hiddenInputRef.current.value = value
              onChange?.(value)
            }
          })

          element.addEventListener('gmp-placeselect', async (event: any) => {
            const place = event.place
            // Try to get formattedAddress — may be pre-populated or need fetchFields
            let address: string | undefined = place.formattedAddress
            if (!address) {
              try {
                await place.fetchFields({ fields: ['formattedAddress'] })
                address = place.formattedAddress
              } catch { /* ignore — requires "Places API (New)" in Google Cloud */ }
            }
            if (!address) address = place.displayName // last resort
            if (address) {
              if (hiddenInputRef.current) hiddenInputRef.current.value = address
              onSelectRef.current?.(address)
              onChange?.(address)
            }
          })

          cleanup = () => { try { element.remove() } catch { } }
          return true
        } catch { /* ignore */ }
      }

      return false
    }

    if (!tryInit()) {
      const interval = setInterval(() => { if (tryInit()) clearInterval(interval) }, 300)
      return () => { clearInterval(interval); cleanup?.() }
    }
    return () => cleanup?.()
  }, [])

  const inputClass = `flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent disabled:opacity-50${className ? ` ${className}` : ''}`

  return (
    <>
      {/* New API container (PlaceAutocompleteElement) — hidden unless old API unavailable */}
      <div ref={newApiWrapperRef} style={{ display: 'none' }} className="w-full" />

      {/* Old API input — our styled input, visible by default */}
      <input
        ref={legacyInputRef}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        onChange={e => {
          if (hiddenInputRef.current) hiddenInputRef.current.value = e.target.value
          onChange?.(e.target.value)
        }}
        className={inputClass}
      />

      {/* Hidden field submitted with the form — updated by both paths */}
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={defaultValue} />
    </>
  )
}
