import axios from "axios";

// Arc Testnet's shared public RPC is occasionally slow (a handful of
// seconds to ~30s) even after the server-side fixes in onchain-data-fast.ts
// (see train.md). Plain axios has no default timeout, so a slow request
// would otherwise hold the connection open indefinitely instead of failing
// fast and letting react-query's own retry kick in with a fresh attempt.
export const apiClient = axios.create({
  timeout: 20_000,
});
