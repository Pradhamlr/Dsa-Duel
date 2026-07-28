// In-memory per-contest SSE connection registry. Deliberately in-process, not a shared
// pub/sub layer (Redis, Supabase Realtime, etc.) -- this only fans out correctly on a
// single backend instance, which is what's actually running today (server.js, no
// clustering). A horizontally-scaled deployment would need a shared layer to broadcast
// across instances; documented here as a known, deliberate scaling boundary, not hidden.
const contestClients = new Map(); // contestId -> Set<{ res, userId, name }>

function writeEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// One roster entry per distinct connected userId, even if they have multiple tabs/
// connections open to the same contest.
function rosterFor(contestId) {
  const clients = contestClients.get(contestId);
  if (!clients) return [];
  const seen = new Map();
  for (const c of clients) {
    if (!seen.has(c.userId)) seen.set(c.userId, { userId: c.userId, name: c.name || null });
  }
  return Array.from(seen.values());
}

// Snapshot of who's currently connected, for Phase 4b's deferred problem
// selection at Start -- distinct userIds only, same dedup as the roster panel.
export function getRosterUserIds(contestId) {
  return rosterFor(contestId).map((r) => r.userId);
}

export function registerClient(contestId, userId, name, res) {
  if (!contestClients.has(contestId)) contestClients.set(contestId, new Set());
  const client = { res, userId, name };
  contestClients.get(contestId).add(client);
  broadcastRoster(contestId);
  return client;
}

export function unregisterClient(contestId, client) {
  const clients = contestClients.get(contestId);
  if (!clients) return;
  clients.delete(client);
  if (clients.size === 0) contestClients.delete(contestId);
  else broadcastRoster(contestId);
}

// Called after any mutation that changes contest state (mark/verify/judge-accept/start)
// with the exact same payload shape the mutating request itself returns over HTTP --
// no extra DB round-trip needed for the broadcast.
export function broadcastContestUpdate(contestId, contestPayload) {
  const clients = contestClients.get(contestId);
  if (!clients) return;
  for (const { res } of clients) writeEvent(res, 'contest', contestPayload);
}

export function broadcastRoster(contestId) {
  const clients = contestClients.get(contestId);
  if (!clients) return;
  const roster = rosterFor(contestId);
  for (const { res } of clients) writeEvent(res, 'roster', roster);
}

// SSE connections are held open indefinitely by design -- server.close() alone would
// hang waiting for them to end naturally, which never happens on their own. Called from
// server.js's graceful-shutdown handler so a redeploy ends every open stream cleanly
// instead of the process just being killed out from under them.
export function closeAllConnections() {
  for (const clients of contestClients.values()) {
    for (const { res } of clients) {
      try { res.end(); } catch (e) { /* already closed */ }
    }
  }
  contestClients.clear();
}
