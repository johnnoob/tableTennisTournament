import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化 ISO 時間為本地展示時間
 * @param dateString UTC 時間字串、Date 物件或空值
 * @param formatStr 格式化語法，預設為 'yyyy-MM-dd HH:mm'
 */
export function formatLocalTime(
  dateString: string | Date | undefined | null, 
  formatStr: string = 'yyyy-MM-dd HH:mm'
): string {
  if (!dateString) return ''
  
  try {
    const date = new Date(dateString)
    
    if (isNaN(date.getTime())) {
      console.warn("Invalid date passed to formatLocalTime:", dateString)
      // 若解析失敗，回傳原始字串供查驗，而不是空字串
      return typeof dateString === 'string' ? dateString : ''
    }
    
    return format(date, formatStr)
  } catch (error) {
    console.error("Time formatting error:", error)
    return typeof dateString === 'string' ? dateString : ''
  }
}
