import type { CrmSnapshot, Staff } from "./types"

export const STAFF: Staff[] = [
  {
    id: "st-maryam",
    name: "Priya Menon",
    role: "Director",
    photoSeed: "shw-priya-menon",
  },
  {
    id: "st-yusuf",
    name: "Yusuf Rahman",
    role: "Contractor desk",
    photoSeed: "shw-yusuf-rahman",
  },
  {
    id: "st-laila",
    name: "Laila Hassan",
    role: "Projects",
    photoSeed: "shw-laila-hassan",
  },
  {
    id: "st-sandeep",
    name: "Sandeep Nair",
    role: "Counter",
    photoSeed: "shw-sandeep-nair",
  },
]

export const EMPTY_CRM: CrmSnapshot = {
  staff: STAFF,
  leads: [],
  activities: [],
  quotes: [],
  accounts: [],
  followUps: [],
}

/** Empty book — demo customers and quotes are not preloaded. */
export const SEED = EMPTY_CRM
