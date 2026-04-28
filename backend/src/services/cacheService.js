// Caching has been removed from this platform.
// All functions are no-ops so existing call sites don't need changes.

export const cacheGet = async () => null;
export const cacheSet = async () => {};
export const cacheDelete = async () => {};
export const cacheDeletePattern = async () => {};
