import { es, type Dict } from '@/lib/i18n/dictionaries/es'
import { en } from '@/lib/i18n/dictionaries/en'
import { pt } from '@/lib/i18n/dictionaries/pt'
import { de } from '@/lib/i18n/dictionaries/de'
import type { Lang } from '@/lib/i18n/config'

export type { Dict }
export const dictionaries: Record<Lang, Dict> = { es, en, pt, de }
