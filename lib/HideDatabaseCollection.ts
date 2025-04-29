const MONGOKU_EXCLUDE_DATABASES = process.env.MONGOKU_EXCLUDE_DATABASES ? process.env.MONGOKU_EXCLUDE_DATABASES.split(',').map(s => s.trim().toLowerCase()) : [];

export function hideDatabase(name: string): boolean {
    return MONGOKU_EXCLUDE_DATABASES.includes(name.toLowerCase());
}
