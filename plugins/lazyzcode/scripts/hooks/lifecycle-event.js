#!/usr/bin/env node
'use strict';

// lifecycle-event.js — ZCode PermissionRequest advisory consumer.
//
// ZCode supports exactly seven hook events; this dispatcher is wired only to
// PermissionRequest (see hooks/hooks.json and contracts/zcode-hook-consumers.v1.json).
// Behaviour: whitelist the event fields, redact secret-like keys/values,
// omit transcript_path, and append a normalized record to the workspace
// .lazyzcode/ state logs — best-effort.
//
// ZCode output contract: print NOTHING on stdout (any stdout is parsed as
// strict JSON); diagnostics go to stderr. Advisory consumer: ALWAYS exits 0
// (never denies; ZCode deny would be exit code 2, which this hook must not use).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = path.join(PLUGIN_ROOT, 'contracts', 'zcode-hook-consumers.v1.json');
const EVENT = 'PermissionRequest';
const SECRET_KEY = /(?:^|_)(?:token|password|secret|credential|grant|api_?key|private_?key|remote_?key|raw_?prompt|prompt|private_?transcript|transcript|authorization|oauth)(?:$|_)/i;
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._-]{10,}|\bsk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const PATH_FIELDS = new Set(['path', 'file_path', 'old_cwd', 'new_cwd', 'worktree_path']);
const OMITTED_COMMON_FIELDS = new Set(['transcript_path']);
let MAX_INPUT_BYTES = 65536;
let ACTIVE_STATUSES = new Set(['active', 'paused', 'created', 'planning', 'executing', 'blocked', 'verifying', 'reviewing']);
let REQUIRED_EVENT_FIELDS = ['request_id', 'tool_name'];
try {
  const CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  MAX_INPUT_BYTES = CONTRACT.boundary.max_payload_bytes;
  if (Array.isArray(CONTRACT.boundary.active_statuses)) ACTIVE_STATUSES = new Set(CONTRACT.boundary.active_statuses);
  const consumer = CONTRACT.events[EVENT];
  if (consumer && Array.isArray(consumer.required_fields)) REQUIRED_EVENT_FIELDS = consumer.required_fields;
} catch (error) {
  process.stderr.write(JSON.stringify({ status: 'error', reason: 'contract_unavailable', detail: String(error && error.message) }) + '\n');
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSecretKey(key) {
  return SECRET_KEY.test(key) && !OMITTED_COMMON_FIELDS.has(key);
}

function redact(value, location = '$') {
  if (Array.isArray(value)) return value.map((item, index) => redact(item, `${location}[${index}]`));
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSecretKey(key)) continue; // omit secret-like fields entirely
      out[key] = redact(item, `${location}.${key}`);
    }
    return out;
  }
  if (typeof value === 'string') {
    let redacted = value.replace(SECRET_VALUE, '[redacted]');
    if (redacted !== value) return { redacted: true, sha256: digest(value), bytes: Buffer.byteLength(value) };
    return redacted;
  }
  return value;
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function summarized(value) {
  return { redacted: true, sha256: digest(value), bytes: Buffer.byteLength(value) };
}

function normalizedPath(value, projectRoot) {
  const resolved = path.resolve(projectRoot, value);
  return within(projectRoot, resolved) ? { project_relative: path.relative(projectRoot, resolved) || '.' } : summarized(value);
}

function activeRun(projectRoot) {
  const runsRoot = path.join(projectRoot, '.lazyzcode', 'runs');
  let entries;
  try {
    entries = fs.readdirSync(runsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
  for (const entry of entries) {
    const statePath = path.join(runsRoot, entry.name, 'state.json');
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state !== null && typeof state === 'object' && ACTIVE_STATUSES.has(state.status)) return { state, statePath };
    } catch {}
  }
  return null;
}

function atomicWrite(target, value) {
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function updateState(active, eventId, occurredAt, outcome = 'requested') {
  if (active === null) return;
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('python3', [
    path.join(PLUGIN_ROOT, 'scripts', 'state', 'run_controller.py'),
    'hook', path.dirname(active.statePath), eventId, occurredAt, EVENT, outcome,
  ], { encoding: 'utf8', timeout: 7000, maxBuffer: 65536 });
  if (result.status !== 0) {
    process.stderr.write(JSON.stringify({ status: 'deferred', reason: 'state_transaction_unavailable' }) + '\n');
  }
}

function processEvent() {
  let input = fs.readFileSync(0);
  if (input.length > MAX_INPUT_BYTES) {
    process.stderr.write(JSON.stringify({ status: 'rejected', reason: 'payload_too_large', detail: `input exceeds ${MAX_INPUT_BYTES} bytes` }) + '\n');
    return;
  }
  let payload;
  try {
    payload = JSON.parse(input.toString('utf8'));
  } catch {
    process.stderr.write(JSON.stringify({ status: 'rejected', reason: 'malformed_json', detail: 'stdin must contain one JSON object' }) + '\n');
    return;
  }
  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    process.stderr.write(JSON.stringify({ status: 'rejected', reason: 'malformed_json', detail: 'stdin must contain one JSON object' }) + '\n');
    return;
  }
  payload = redact(payload); // redacts secret-like keys/values before anything is persisted
  const event = typeof payload.hook_event_name === 'string' ? payload.hook_event_name : EVENT;
  if (event !== EVENT) {
    process.stderr.write(JSON.stringify({ status: 'rejected', reason: 'unsupported_event', detail: event }) + '\n');
    return;
  }
  const sessionId = typeof payload.session_id === 'string' && payload.session_id.length > 0 ? payload.session_id : null;
  const cwdText = typeof payload.cwd === 'string' && payload.cwd.length > 0 ? payload.cwd : process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!sessionId) {
    process.stderr.write(JSON.stringify({ status: 'rejected', reason: 'missing_common_field', detail: 'session_id is required' }) + '\n');
    return;
  }
  for (const field of REQUIRED_EVENT_FIELDS) {
    if (typeof payload[field] !== 'string' || payload[field].length === 0) {
      process.stderr.write(JSON.stringify({ status: 'rejected', reason: 'missing_event_field', detail: `${EVENT}.${field} is required` }) + '\n');
      return;
    }
  }
  const projectRoot = path.resolve(cwdText);
  const whitelist = ['request_id', 'tool_name', 'reason'];
  const normalizedPayload = {};
  for (const key of whitelist) {
    const value = payload[key];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      normalizedPayload[key] = PATH_FIELDS.has(key) ? normalizedPath(value, projectRoot) : value.slice(0, 128);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      normalizedPayload[key] = value;
    }
  }
  const identity = JSON.stringify({ session_id: sessionId, event: EVENT, cwd: projectRoot, payload: normalizedPayload, delivery_id: payload.event_id || payload.delivery_id || null });
  const eventId = `evt:${digest(identity)}`;
  const sessionKey = digest(sessionId).slice(0, 24);
  const recordDir = path.join(projectRoot, '.lazyzcode', 'hook-events', sessionKey);
  const recordPath = path.join(recordDir, `${eventId.slice(4)}.json`);
  try {
    fs.mkdirSync(recordDir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(recordPath)) return; // duplicate delivery — already recorded
    const occurredAt = payload.occurred_at === undefined || Number.isNaN(Date.parse(payload.occurred_at))
      ? new Date().toISOString()
      : new Date(payload.occurred_at).toISOString();
    const active = activeRun(projectRoot);
    const record = {
      schema_version: 1,
      record_type: 'normalized-hook-event',
      event_id: eventId,
      session_id: sessionId,
      raw_event: EVENT,
      canonical_event: 'permission-request',
      occurred_at: occurredAt,
      cwd: projectRoot,
      consumer: { name: 'permission-audit', mode: 'advisory', completion_authority: false, invalidates: [] },
      payload: normalizedPayload,
    };
    updateState(active, eventId, occurredAt);
    atomicWrite(recordPath, record);
  } catch (error) {
    // Best-effort persistence: a state-log failure must never fail the hook.
    process.stderr.write(JSON.stringify({ status: 'error', reason: 'internal_error', detail: String(error && error.message) }) + '\n');
  }
}

processEvent();
process.exitCode = 0;
