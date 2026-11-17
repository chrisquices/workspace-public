export type User = {
    id: number
    name: string
    email: string
    avatar?: string
    emailVerifiedAt: string | null
    createdAt: string
    updatedAt: string
    [key: string]: unknown
};

export type Auth = {
    user: User | null
};
