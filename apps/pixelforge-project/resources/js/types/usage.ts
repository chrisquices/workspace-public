export type UserUsageSortColumn = "date" | "userName" | "creditSpend" | "providerCost" | "profit";

export interface UsageUserOption {
    id: number
    name: string
}

export interface UserUsage {
    date: string
    dateFormatted: string
    userId: number
    userName: string
    creditSpend: string
    creditSpendFormatted: string
    providerCost: string
    providerCostFormatted: string
    profit: string
    profitFormatted: string
}
