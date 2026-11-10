import { useTheme } from './theme'

/** Karanlık mod açık mı — grafik renkleri için */
export function useDark(): boolean {
  return useTheme() === 'dark'
}
