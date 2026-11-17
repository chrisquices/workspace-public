export type GenerationStatus = "pending" | "queued" | "processing" | "succeeded" | "failed";

export interface GenerationEstimate {
    currency: string
    minPriceUsd: string
    minPriceUsdFormatted: string
    maxPriceUsd: string
    maxPriceUsdFormatted: string
}

export interface GenerationEstimateInput {
    prompt: string
    size: string
    quality: string
    referenceImageCount: number
}

export interface Generation {
    uuid: string
    providerGenerationId: string | null
    prompt: string
    size: string
    quality: "low" | "medium" | "high"
    status: GenerationStatus
    canBeDeleted: boolean
    referenceImages: string[]
    metadata: {
        dimensions: string
        quality: string
        estimatedCost: string
        actualCost: string
        created: string
    }
    imageUrl: string | null
    imageExpired: boolean
    errorMessage: string | null
}

export interface GenerationFilters {
    search: string
    sortBy: "prompt" | "created_at"
    sortDirection: "asc" | "desc"
}
