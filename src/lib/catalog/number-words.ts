const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
]

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function threeDigitsToWords(n: number) {
  let str = ""
  if (n >= 100) {
    str += `${ONES[Math.floor(n / 100)]} Hundred `
    n %= 100
  }
  if (n >= 20) {
    str += `${TENS[Math.floor(n / 10)]} `
    n %= 10
  }
  if (n > 0) str += `${ONES[n]} `
  return str.trim()
}

/** Indian numbering (Lakh / Crore) for proforma amount in words. */
export function numberToWordsINR(amount: number) {
  let n = Math.round(amount)
  if (n === 0) return "Zero"

  const crore = Math.floor(n / 10_000_000)
  n %= 10_000_000
  const lakh = Math.floor(n / 100_000)
  n %= 100_000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const hundred = n

  const parts: string[] = []
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`)
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`)
  if (hundred) parts.push(threeDigitsToWords(hundred))

  return parts.join(" ")
}
