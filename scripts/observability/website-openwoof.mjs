import { randomBytes } from "node:crypto";
import { spawn as spawnProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const TARGET = Object.freeze({
  endpoint: "wss://192.168.0.2:8443/api/current",
  origin: "https://192.168.0.2:8443",
  app: "website",
  catalogApp: "ix-app",
  catalogVersion: "1.4.4",
  service: "website",
  environment: "production",
  uid: 1001,
  gid: 1001,
  websiteParentDirectory: "/mnt/Lake",
  repository: "ghcr.io/javadevjt/website",
  websiteDirectory: "/mnt/Lake/website-openwoof",
  hostDirectory: "/mnt/Lake/website-openwoof/secrets",
  hostKey: "/mnt/Lake/website-openwoof/secrets/openwoof-ingest.key",
  keyTarget: "/run/secrets/openwoof-ingest-key",
  otlpEndpoint: "https://openwoof.javadevjt.tech",
  sourceBase: "aaf86d9ee76a9c6ae1f18560e707aac178da46e3",
  sourceBaseImageTag: "latest@sha256:a1a24c3fe75c143990d7bcd40f9042880111cd84e78c841d02d8bee9543239c7",
});

const KEYCHAIN_HELPER = fileURLToPath(new URL("./website-keychain.swift", import.meta.url));
const TRUENAS_CA = readFileSync(new URL("./truenas-ca.pem", import.meta.url));
const REQUEST_TIMEOUT_MS = 45_000;
const FILE_JOB_TIMEOUT_MS = 180_000;
const APP_JOB_TIMEOUT_MS = 15 * 60_000;
const POLL_MS = 5_000;
const MAX_UPLOAD_BYTES = 4096;
const MAX_LOG_LINES = 200;
const MAX_LOG_TEXT = 16_384;
const MAX_TOTAL_LOG_BYTES = 131_072;
const MAX_LOG_TIMESTAMP_CHARS = 64;
const PRIVATE_KEYCHAIN_FD = 3;

const FIXED_ENVIRONMENT = Object.freeze({
  OPENWOOF_TELEMETRY_ENABLED: "true",
  OPENWOOF_INGEST_KEY_FILE: TARGET.keyTarget,
  OTEL_EXPORTER_OTLP_ENDPOINT: TARGET.otlpEndpoint,
  OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
  OTEL_EXPORTER_OTLP_HEADERS: "",
  OTEL_SERVICE_NAME: "website-backend",
});

const SCHEMA_WHITELIST = Object.freeze({
  image: { repository: "string", tag: "string", pull_policy: ["missing", "always", "never"] },
  envs: [{ name: "string", value: "string" }],
  storage: [{
    type: "host_path",
    read_only: "boolean",
    mount_path: "string",
    host_path_config: { path: "string", acl_enable: "boolean" },
  }],
});

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

export class SafeFailure extends Error {
  constructor(phase, { jobId = null, ambiguous = false } = {}) {
    super(phase);
    this.name = "SafeFailure";
    this.phase = phase;
    this.jobId = Number.isSafeInteger(jobId) ? jobId : null;
    this.ambiguous = ambiguous;
  }
}

function fail(phase, options) {
  throw new SafeFailure(phase, options);
}

function exactRecord(value, phase) {
  if (!isRecord(value)) fail(phase);
  return value;
}

function validateSourceDigest(sourceSha, digest) {
  if (typeof sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new TypeError("source SHA must be a full 40-character lowercase commit");
  }
  if (typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new TypeError("image digest must be sha256 followed by 64 lowercase hex characters");
  }
  return Object.freeze({
    sourceSha,
    digest,
    imageTag: `main-${sourceSha.slice(0, 7)}@${digest}`,
    imageRef: `${TARGET.repository}:main-${sourceSha.slice(0, 7)}@${digest}`,
  });
}

export function parseArgs(argv) {
  const values = new Map();
  const known = new Set(["--mode", "--source-sha", "--image-digest", "--confirm", "--tail"]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!known.has(flag) || values.has(flag) || argv[index + 1] === undefined || argv[index + 1].startsWith("--")) {
      throw new TypeError("usage: --mode inspect|dry-run|prepare-key|prepare-delivery|apply|logs [--source-sha SHA --image-digest sha256:HEX] [--confirm website] [--tail 1..200]");
    }
    values.set(flag, argv[++index]);
  }
  const mode = values.get("--mode") ?? "inspect";
  if (!["inspect", "dry-run", "prepare-key", "prepare-delivery", "apply", "logs"].includes(mode)) {
    throw new TypeError("mode must be inspect, dry-run, prepare-key, prepare-delivery, apply, or logs");
  }
  const sourceSha = values.get("--source-sha");
  const digest = values.get("--image-digest");
  let image = null;
  if (mode === "dry-run" || mode === "apply") {
    image = validateSourceDigest(sourceSha, digest);
    if (values.get("--confirm") !== TARGET.app) throw new TypeError("explicit --confirm website is required");
  } else if (sourceSha !== undefined || digest !== undefined || values.has("--confirm")) {
    throw new TypeError("image and confirmation flags are accepted only by dry-run or apply");
  }
  const tailText = values.get("--tail");
  let tail = 50;
  if (tailText !== undefined) {
    if (!/^(?:[1-9][0-9]{0,2})$/.test(tailText)) throw new TypeError("tail must be an integer from 1 to 200");
    tail = Number(tailText);
    if (tail > MAX_LOG_LINES) throw new TypeError("tail must be an integer from 1 to 200");
  }
  if (mode !== "logs" && tailText !== undefined) throw new TypeError("--tail is accepted only by logs");
  return { mode, image, tail };
}

export function assertWebsiteInstance(instance) {
  if (!isRecord(instance) || instance.id !== TARGET.app || instance.custom_app !== false
      || instance.version !== TARGET.catalogVersion || instance.state !== "RUNNING") {
    fail("exact running ix-app website 1.4.4 catalogue instance required");
  }
  const containerDetails = instance.active_workloads?.container_details;
  if (!Array.isArray(containerDetails)) fail("website container metadata unavailable");
  const services = containerDetails.filter(container => container?.service_name === TARGET.service);
  if (services.length !== 1 || typeof services[0]?.id !== "string" || !services[0].id) {
    fail("exactly one website service container required");
  }
  return services[0];
}

function validateEnvironmentList(envs) {
  if (!Array.isArray(envs)) fail("catalogue envs schema drift");
  const names = new Set();
  for (const item of envs) {
    if (!isRecord(item) || typeof item.name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(item.name)
        || typeof item.value !== "string" || names.has(item.name)) fail("catalogue envs schema drift");
    names.add(item.name);
  }
  return envs;
}

function isConflictingEnvironment(name) {
  if (name === "OPENWOOF_INGEST_KEY_FILE") return false;
  if (/^OPENWOOF_.*(?:KEY|TOKEN|SECRET|CREDENTIAL|AUTH)/.test(name)) return true;
  if (name === "OTEL_EXPORTER_OTLP_ENDPOINT" || name === "OTEL_EXPORTER_OTLP_PROTOCOL"
      || name === "OTEL_EXPORTER_OTLP_HEADERS" || name === "OTEL_EXPORTER_OTLP_INSECURE") return true;
  if (!name.startsWith("OTEL_EXPORTER_OTLP_")) return false;
  return /(?:^|_)(?:ENDPOINT|PROTOCOL|HEADERS?)(?:_|$)/.test(name)
    || /(?:AUTH|AUTHENTICATOR|CREDENTIALS?|USERNAME|PASSWORD|TOKEN|SECRET|_KEY|CERTIFICATE|INSECURE)/.test(name);
}

export function buildWebsiteConfig(current, { sourceSha, digest }) {
  const image = validateSourceDigest(sourceSha, digest);
  exactRecord(current, "catalogue values shape");
  if (!Array.isArray(current.storage) || !Array.isArray(current.envs)
      || !Array.isArray(current.entrypoint) || !Array.isArray(current.command)) {
    fail("installed 1.4.4 catalogue values schema drift");
  }
  exactRecord(current.image, "installed image schema drift");
  if (current.image.repository !== TARGET.repository || typeof current.image.tag !== "string") {
    fail("website image repository/schema drift");
  }
  if (current.image.tag !== TARGET.sourceBaseImageTag) fail("website image tag changed; reconcile before update");

  const next = structuredClone(current);
  const envs = validateEnvironmentList(next.envs).filter(item => !isConflictingEnvironment(item.name));
  const byName = new Map(envs.map(item => [item.name, item]));
  const required = {
    ...FIXED_ENVIRONMENT,
    QB_SOURCE_COMMIT: image.sourceSha,
    OTEL_RESOURCE_ATTRIBUTES: `service.namespace=personal-website,deployment.environment.name=production,service.version=${image.sourceSha}`,
  };
  for (const [name, value] of Object.entries(required)) {
    if (byName.has(name)) byName.get(name).value = value;
    else envs.push({ name, value });
  }
  next.envs = envs;
  next.storage = current.storage.filter(item => {
    if (!isRecord(item)) fail("catalogue storage schema drift");
    if (item.mount_path === TARGET.keyTarget
        || item.host_path_config?.path === TARGET.hostKey) fail("ingest key mount already exists; inspect before retrying");
    return true;
  });
  next.storage.push({
    type: "host_path",
    read_only: true,
    mount_path: TARGET.keyTarget,
    host_path_config: { path: TARGET.hostKey, acl_enable: false },
  });
  next.image = { ...next.image, repository: TARGET.repository, tag: image.imageTag };
  return next;
}

export function assertDirectoryAbsent(entries, path) {
  if (!Array.isArray(entries)) fail("NAS directory listing unavailable");
  const name = basename(path);
  if (entries.some(entry => entry?.name === name || entry?.path === path)) {
    fail("website secrets directory already exists; preserve contents and reconcile before retrying");
  }
  return true;
}

export function assertSecretsDirectoryEmpty(entries) {
  if (!Array.isArray(entries)) fail("website secrets directory listing unavailable");
  if (entries.length !== 0) fail("website secrets directory contains unknown entries; preserve contents and reconcile");
  return true;
}

export function assertPrivateDirectoryMetadata(stat, acl, path) {
  return isRecord(stat) && stat.realpath === path && stat.type === "DIRECTORY"
    && stat.uid === TARGET.uid && stat.gid === TARGET.gid && (Number(stat.mode) & 0o7777) === 0o700
    && isRecord(acl) && acl.path === path && acl.trivial === true;
}

export function assertPrivateStagingParentMetadata(stat, acl) {
  return isRecord(stat) && stat.realpath === TARGET.websiteParentDirectory && stat.type === "DIRECTORY"
    && stat.uid === 0 && Number.isSafeInteger(stat.mode) && (stat.mode & 0o0022) === 0
    && isRecord(acl) && acl.path === TARGET.websiteParentDirectory
    && acl.acltype === "POSIX1E" && acl.trivial === true;
}

export async function callMutationOnce(client, method, params = [], timeoutMs = REQUEST_TIMEOUT_MS) {
  try {
    return await client.call(method, params, { mutation: true, timeoutMs });
  } catch {
    fail(`${method} response ambiguous; inspect TrueNAS state before any retry`, { ambiguous: true });
  }
}

export function buildKeySetpermRequest() {
  return {
    path: TARGET.hostKey,
    uid: TARGET.uid,
    gid: TARGET.gid,
    mode: "400",
    options: { recursive: false, traverse: false, stripacl: true },
  };
}

export function buildPrivateDirectoryMkdirRequest(path) {
  if (![TARGET.websiteDirectory, TARGET.hostDirectory].includes(path)) throw new TypeError("invalid website app directory");
  return { path, options: { mode: "700", raise_chmod_error: true } };
}

export function buildPrivateDirectorySetpermRequest(path) {
  if (![TARGET.websiteDirectory, TARGET.hostDirectory].includes(path)) throw new TypeError("invalid website app directory");
  return {
    path, uid: TARGET.uid, gid: TARGET.gid, mode: "700",
    options: { recursive: false, traverse: false, stripacl: true },
  };
}

export function buildStorageMount() {
  return {
    type: "host_path",
    read_only: true,
    mount_path: TARGET.keyTarget,
    host_path_config: { path: TARGET.hostKey, acl_enable: false },
  };
}

export function assertKeyFileMetadata(stat, acl) {
  return isRecord(stat) && stat.realpath === TARGET.hostKey && stat.type === "FILE"
    && Number.isSafeInteger(Number(stat.size)) && Number(stat.size) > 0 && Number(stat.size) <= MAX_UPLOAD_BYTES
    && stat.uid === TARGET.uid && stat.gid === TARGET.gid && (Number(stat.mode) & 0o7777) === 0o400
    && isRecord(acl) && acl.path === TARGET.hostKey && acl.trivial === true;
}

export function assertRuntimeConfiguration(instance, config, expected, serviceContainer) {
  assertWebsiteInstance(instance);
  if (instance.version !== TARGET.catalogVersion || !isRecord(config)
      || !isDeepStrictEqual(config, expected)) fail("website config readback mismatch");
  const expectedDigest = expected.image.tag.match(/@(sha256:[a-f0-9]{64})$/)?.[1];
  const canonicalTaggedImage = `${TARGET.repository}:${expected.image.tag}`;
  const canonicalDigestImage = expectedDigest ? `${TARGET.repository}@${expectedDigest}` : null;
  if (serviceContainer?.service_name !== TARGET.service || serviceContainer?.state !== "running"
      || typeof serviceContainer?.image !== "string" || !expectedDigest
      || (serviceContainer.image !== canonicalTaggedImage && serviceContainer.image !== canonicalDigestImage)) {
    fail("website container identity readback mismatch");
  }
  const mounts = serviceContainer.volume_mounts;
  if (!Array.isArray(mounts) || !mounts.some(mount => mount?.source === TARGET.hostKey
      && mount?.destination === TARGET.keyTarget && mount?.mode === "ro" && mount?.type === "bind")) {
    fail("read-only website key mount readback mismatch");
  }
  return true;
}

export function redactLogLine(line) {
  if (typeof line !== "string") return "[non-text log line redacted]";
  let value = line.slice(0, MAX_LOG_TEXT);
  value = value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;"']+/ig, "$1[REDACTED]")
    .replace(/(bearer\s+)[A-Za-z0-9._~+\/-]+=*/ig, "$1[REDACTED]")
    .replace(/((?:password|passwd|secret|token|api[_-]?key|ingest[_-]?key|client[_-]?secret|authorization)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)"?/ig, "$1[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[JWT]")
    .replace(/(https?:\/\/[^\s?]+)\?[^\s"']+/ig, "$1?[REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(/\b\+?\d[\d .()-]{7,}\d\b/g, candidate => candidate.replace(/\D/g, "").length >= 10 ? "[PHONE]" : candidate)
    .replace(/(Cookie\s*:\s*)[^\r\n]+/ig, "$1[REDACTED]");
  return value;
}

function truncateUtf8(text, maxBytes) {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  let used = 0;
  let bounded = "";
  for (const character of text) {
    const size = Buffer.byteLength(character, "utf8");
    if (used + size > maxBytes) break;
    bounded += character;
    used += size;
  }
  return bounded;
}

export function boundLogEntry(line, timestamp, remainingBytes) {
  if (typeof line !== "string" || !Number.isSafeInteger(remainingBytes) || remainingBytes < 0) return null;
  const boundedTimestamp = typeof timestamp === "string" ? timestamp.slice(0, MAX_LOG_TIMESTAMP_CHARS) : null;
  const timestampBytes = boundedTimestamp === null ? 0 : Buffer.byteLength(boundedTimestamp, "utf8");
  if (timestampBytes > remainingBytes) return null;
  const safeLine = truncateUtf8(redactLogLine(line), Math.min(MAX_LOG_TEXT, remainingBytes - timestampBytes));
  return {
    entry: { timestamp: boundedTimestamp, line: safeLine },
    bytes: timestampBytes + Buffer.byteLength(safeLine, "utf8"),
  };
}

export function extractBoundedLogEntry(message, eventName, remainingBytes) {
  if (!isRecord(message) || message.method !== "collection_update" || !isRecord(message.params)) return null;
  const { collection, msg, fields } = message.params;
  if (collection !== eventName || !["added", "ADDED"].includes(msg)
      || !isRecord(fields) || typeof fields.data !== "string") return null;
  return boundLogEntry(fields.data, fields.timestamp, remainingBytes);
}

export function buildLogEventName(containerId, tail) {
  if (typeof containerId !== "string" || !containerId || !Number.isInteger(tail)
      || tail < 1 || tail > MAX_LOG_LINES) throw new TypeError("invalid website container log subscription");
  return `app.container_log_follow:${JSON.stringify({ app_name: TARGET.app, container_id: containerId, tail_lines: tail })}`;
}

export function projectInspection(instance, config) {
  const container = assertWebsiteInstance(instance);
  exactRecord(config, "catalogue values unavailable");
  exactRecord(config.image, "catalogue image schema unavailable");
  if (!Array.isArray(config.envs) || !Array.isArray(config.storage)) fail("catalogue schema unavailable");
  return {
    target: { instance: TARGET.app, catalog: TARGET.catalogApp, version: instance.version, state: instance.state, customApp: instance.custom_app },
    service: { name: TARGET.service, state: container.state },
    schemaWhitelist: SCHEMA_WHITELIST,
    current: {
      image: {
        repository: config.image.repository,
        tag: config.image.tag,
        pull_policy: config.image.pull_policy ?? "implicit-default",
      },
      environment: config.envs.map(item => ({ name: typeof item?.name === "string" ? item.name : "[unknown]", configured: typeof item?.value === "string" })),
      storageCount: config.storage.length,
      entrypointCount: Array.isArray(config.entrypoint) ? config.entrypoint.length : null,
      commandCount: Array.isArray(config.command) ? config.command.length : null,
    },
  };
}

export function buildUploadBody(path, bytes, boundary = randomBytes(18).toString("hex")) {
  if (path !== TARGET.hostKey || !(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES
      || !/^[a-f0-9]{36}$/.test(boundary)) throw new TypeError("invalid bounded website key upload");
  const metadata = JSON.stringify({ method: "filesystem.put", params: [path, { append: false, mode: 0o400 }] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="data"\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${basename(path)}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { boundary, body };
}

export function buildManagementWebSocketOptions() {
  return {
    tls: {
      ca: Buffer.from(TRUENAS_CA),
      serverName: "localhost",
      rejectUnauthorized: true,
    },
  };
}

class TrueNASClient {
  constructor() {
    this.socket = new WebSocket(TARGET.endpoint, buildManagementWebSocketOptions());
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.closed = false;
    this.socket.onmessage = event => this.onMessage(event);
    this.socket.onerror = () => this.rejectAll("TrueNAS WebSocket error");
    this.socket.onclose = () => this.rejectAll("TrueNAS WebSocket closed");
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new SafeFailure("TrueNAS WebSocket open timeout")), REQUEST_TIMEOUT_MS);
      this.socket.onopen = () => { clearTimeout(timer); resolve(); };
      this.socket.onerror = () => { clearTimeout(timer); reject(new SafeFailure("TrueNAS WebSocket connection failed")); };
    });
  }

  onMessage(event) {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { this.rejectAll("invalid TrueNAS response"); return; }
    if (!Number.isSafeInteger(message?.id)) {
      for (const listener of this.listeners) listener(message);
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new SafeFailure(pending.phase, { ambiguous: pending.mutation }));
    else pending.resolve(message.result);
  }

  rejectAll(phase) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new SafeFailure(pending.phase || phase, { ambiguous: pending.mutation }));
    }
    this.pending.clear();
  }

  call(method, params = [], { mutation = false, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new SafeFailure(`${method} connection`, { ambiguous: mutation }));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new SafeFailure(method, { ambiguous: mutation }));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, phase: method, mutation });
      try { this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new SafeFailure(method, { ambiguous: mutation })); }
    });
  }

  async close() {
    this.rejectAll("closed");
    try { this.socket.close(); } catch {}
  }
}

async function runKeychain(mode, { privateBytes = false } = {}) {
  const privateModes = new Set(["read-ingest", "read-truenas-api"]);
  if (privateModes.has(mode) !== privateBytes) fail("Keychain read channel guard");
  if (privateBytes) return await readKeychainOnPrivateFd(mode);

  const child = Bun.spawn(["swift", KEYCHAIN_HELPER, mode], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
  let result = null;
  try {
    result = new Uint8Array(await new Response(child.stdout).arrayBuffer());
    const status = await child.exited;
    if (status !== 0 || result.length === 0) fail("Keychain operation unavailable");
    if (privateBytes) return result;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(result).trim();
    result.fill(0);
    if (!["created", "already-present"].includes(text)) fail("Keychain status invalid");
    return text;
  } catch (error) {
    result?.fill(0);
    if (error instanceof SafeFailure) throw error;
    fail("Keychain operation unavailable");
  }
}

async function readKeychainOnPrivateFd(mode) {
  return await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess("swift", [KEYCHAIN_HELPER, mode, "--private-fd", String(PRIVATE_KEYCHAIN_FD)], {
        stdio: ["ignore", "ignore", "ignore", "pipe"],
      });
    } catch {
      fail("Keychain private channel unavailable");
    }

    const chunks = [];
    let size = 0;
    let settled = false;
    const clearChunks = () => {
      for (const chunk of chunks) chunk.fill(0);
      chunks.length = 0;
    };
    const finish = (error, value) => {
      if (settled) {
        value?.fill(0);
        return;
      }
      settled = true;
      if (error) {
        clearChunks();
        reject(error);
      } else {
        clearChunks();
        resolve(value);
      }
    };
    const privatePipe = child.stdio[PRIVATE_KEYCHAIN_FD];
    if (!privatePipe) {
      child.kill();
      finish(new SafeFailure("Keychain private channel unavailable"));
      return;
    }
    privatePipe.on("data", chunk => {
      if (settled) {
        chunk.fill(0);
        return;
      }
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        chunk.fill(0);
        child.kill();
        finish(new SafeFailure("Keychain data exceeds the private channel limit"));
        return;
      }
      chunks.push(Buffer.from(chunk));
      chunk.fill(0);
    });
    privatePipe.on("error", () => finish(new SafeFailure("Keychain private channel failed")));
    child.once("error", () => finish(new SafeFailure("Keychain operation unavailable")));
    child.once("close", code => {
      if (settled) return;
      if (code !== 0 || size === 0) {
        finish(new SafeFailure("Keychain operation unavailable"));
        return;
      }
      finish(null, Buffer.concat(chunks, size));
    });
  });
}

async function connectTrueNAS() {
  let keyBytes = await runKeychain("read-truenas-api", { privateBytes: true });
  let apiKey = "";
  try { apiKey = new TextDecoder("utf-8", { fatal: true }).decode(keyBytes); }
  catch { keyBytes.fill(0); fail("TrueNAS Keychain credential invalid"); }
  keyBytes.fill(0);
  const client = new TrueNASClient();
  try {
    await client.open();
    const authenticated = await client.call("auth.login_with_api_key", [apiKey]);
    apiKey = "";
    if (authenticated !== true) fail("TrueNAS authentication");
    return client;
  } catch (error) {
    apiKey = "";
    await client.close();
    if (error instanceof SafeFailure) throw error;
    fail("TrueNAS authentication");
  }
}

async function readAppRaw(client) {
  const [instance, config] = await Promise.all([
    client.call("app.get_instance", [TARGET.app]),
    client.call("app.config", [TARGET.app]),
  ]);
  return { instance, config };
}

async function readApp(client) {
  const { instance, config } = await readAppRaw(client);
  assertWebsiteInstance(instance);
  exactRecord(config, "website catalogue values unavailable");
  return { instance, config };
}

function extractJobId(result) {
  const id = Number.isSafeInteger(result) ? result : result?.id;
  if (!Number.isSafeInteger(id) || id <= 0) {
    fail("TrueNAS mutation returned no job identifier; inspect state before retrying", { ambiguous: true });
  }
  return id;
}

async function waitForJob(client, jobId, timeoutMs, phase) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let job;
    try { job = await client.call("core.get_jobs", [[["id", "=", jobId]], { get: true }]); }
    catch { fail(`${phase} status read unavailable; inspect TrueNAS state before any retry`, { jobId, ambiguous: true }); }
    const value = Array.isArray(job) ? job[0] : job;
    if (isRecord(value) && value.id === jobId && value.state === "SUCCESS") return { id: jobId, state: value.state };
    if (isRecord(value) && ["FAILED", "ABORTED"].includes(value.state)) fail(phase, { jobId });
    await Bun.sleep(POLL_MS);
  }
  fail(`${phase} timeout`, { jobId, ambiguous: true });
}

async function waitForRuntime(client, expected) {
  const deadline = Date.now() + APP_JOB_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { instance, config } = await readAppRaw(client);
    if (!isRecord(instance) || instance.id !== TARGET.app || instance.custom_app !== false
        || instance.version !== TARGET.catalogVersion) {
      fail("website identity changed during deployment");
    }
    if (instance.state === "RUNNING") {
      const container = assertWebsiteInstance(instance);
      assertRuntimeConfiguration(instance, config, expected, container);
      return { instance, config, container };
    }
    if (!["DEPLOYING", "STOPPING", "STOPPED"].includes(instance.state)) {
      fail("website did not return to a healthy catalogue state");
    }
    await Bun.sleep(POLL_MS);
  }
  fail("website runtime readback timeout; inspect TrueNAS state before any retry", { ambiguous: true });
}

function assertManagementUrl(url) {
  if (!(url instanceof URL) || url.origin !== TARGET.origin || url.pathname !== "/_upload/"
      || url.username || url.password || url.search || url.hash || url.href !== `${TARGET.origin}/_upload/`) {
    fail("TrueNAS upload endpoint guard");
  }
}

export function buildUploadRequest(url, boundary, contentLength, token) {
  assertManagementUrl(url);
  if (typeof boundary !== "string" || !/^[a-f0-9]{36}$/.test(boundary)
      || !Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_UPLOAD_BYTES + 8192
      || typeof token !== "string" || !/^[A-Za-z0-9._~+/-]{16,4096}={0,}$/.test(token)) {
    throw new TypeError("invalid bounded website key upload request");
  }
  return {
    url: url.href,
    options: {
      method: "POST",
      ca: Buffer.from(TRUENAS_CA),
      servername: "localhost",
      rejectUnauthorized: true,
      agent: false,
      headers: {
        authorization: `Token ${token}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(contentLength),
      },
    },
  };
}

function postUpload(url, boundary, body, token) {
  const requestSpec = buildUploadRequest(url, boundary, body.length, token);
  return new Promise((resolve, reject) => {
    let settled = false;
    let responseBytes = 0;
    const chunks = [];
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    let request;
    try {
      request = httpsRequest(new URL(requestSpec.url), {
        ...requestSpec.options,
      }, response => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume(); finish(reject, new SafeFailure("key upload HTTP", { ambiguous: true })); return;
        }
        response.on("data", chunk => {
          responseBytes += chunk.length;
          if (responseBytes > 1024 * 1024) { response.destroy(); finish(reject, new SafeFailure("key upload response", { ambiguous: true })); return; }
          chunks.push(chunk);
        });
        response.on("end", () => {
          try { finish(resolve, JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
          catch { finish(reject, new SafeFailure("key upload response", { ambiguous: true })); }
        });
        response.on("error", () => finish(reject, new SafeFailure("key upload response", { ambiguous: true })));
      });
    } finally {
      requestSpec.options.headers.authorization = "";
    }
    const timer = setTimeout(() => request.destroy(new Error("upload timeout")), REQUEST_TIMEOUT_MS);
    request.on("error", () => finish(reject, new SafeFailure("key upload transport", { ambiguous: true })));
    request.on("close", () => clearTimeout(timer));
    request.end(body);
  });
}

async function uploadKey(client, keyBytes) {
  if (!(keyBytes instanceof Uint8Array) || keyBytes.length === 0 || keyBytes.length > MAX_UPLOAD_BYTES) {
    fail("ingest-key data invalid");
  }
  let token = "";
  let body = null;
  try {
    token = await client.call("auth.generate_token", [600, {}, true, true]);
    if (typeof token !== "string" || token.length < 16) fail("TrueNAS upload token unavailable");
    const url = new URL("/_upload/", TARGET.origin);
    const boundary = randomBytes(18).toString("hex");
    ({ body } = buildUploadBody(TARGET.hostKey, keyBytes, boundary));
    const result = await postUpload(url, boundary, body, token);
    const jobId = extractJobId(result?.job_id);
    return await waitForJob(client, jobId, FILE_JOB_TIMEOUT_MS, "key upload job");
  } catch (error) {
    if (error instanceof SafeFailure) throw error;
    fail("key upload failed", { ambiguous: true });
  } finally {
    token = "";
    body?.fill(0);
  }
}

async function directoryEntries(client, path) {
  let entries;
  try { entries = await client.call("filesystem.listdir", [path]); }
  catch { fail("website secret directory state cannot be inspected"); }
  if (!Array.isArray(entries)) fail("website secret directory listing unavailable");
  return entries;
}

async function verifyPrivateDirectory(client, path, label, ambiguous = false) {
  let stat;
  let acl;
  try {
    [stat, acl] = await Promise.all([
      client.call("filesystem.stat", [path]),
      client.call("filesystem.getacl", [path, true, false]),
    ]);
  } catch {
    fail(`${label} permission readback unavailable`, { ambiguous });
  }
  if (!assertPrivateDirectoryMetadata(stat, acl, path)) {
    fail(`${label} is not owned by the website service with mode 0700 and a trivial ACL`, { ambiguous });
  }
}

async function verifyPrivateStagingParent(client, label) {
  let stat;
  let acl;
  try {
    [stat, acl] = await Promise.all([
      client.call("filesystem.stat", [TARGET.websiteParentDirectory]),
      client.call("filesystem.getacl", [TARGET.websiteParentDirectory, true, false]),
    ]);
  } catch {
    fail(`${label} staging parent readback unavailable`);
  }
  if (!assertPrivateStagingParentMetadata(stat, acl)) {
    fail(`${label} staging parent changed; expected root-owned nonwritable POSIX1E directory`);
  }
}

async function setPrivateDirectoryPermissions(client, path, label) {
  const result = await callMutationOnce(client, "filesystem.setperm", [buildPrivateDirectorySetpermRequest(path)]);
  const jobId = extractJobId(result);
  await waitForJob(client, jobId, FILE_JOB_TIMEOUT_MS, `${label} permission job`);
  await verifyPrivateDirectory(client, path, label, true);
}

async function createPrivateDirectory(client, path, label) {
  // mkdir is nonrecursive and EEXIST-safe; never infer success from its return payload.
  await callMutationOnce(client, "filesystem.mkdir", [buildPrivateDirectoryMkdirRequest(path)]);
  await setPrivateDirectoryPermissions(client, path, label);
}

async function requireWebsiteDirectory(client) {
  await verifyPrivateStagingParent(client, "website");
  const entries = await directoryEntries(client, TARGET.websiteParentDirectory);
  if (!entries.some(entry => entry?.name === basename(TARGET.websiteDirectory) || entry?.path === TARGET.websiteDirectory)) {
    fail("website app directory is absent; run prepare-delivery before delivery");
  }
  await verifyPrivateDirectory(client, TARGET.websiteDirectory, "website app directory");
}

async function ensurePrivateWebsiteDirectory(client) {
  await verifyPrivateStagingParent(client, "website");
  const entries = await directoryEntries(client, TARGET.websiteParentDirectory);
  const exists = entries.some(entry => entry?.name === basename(TARGET.websiteDirectory) || entry?.path === TARGET.websiteDirectory);
  if (exists) {
    await verifyPrivateDirectory(client, TARGET.websiteDirectory, "existing website app directory");
    return;
  }
  await createPrivateDirectory(client, TARGET.websiteDirectory, "new website app directory");
}

async function assertSecretsDirectoryAbsentOnNas(client) {
  assertDirectoryAbsent(await directoryEntries(client, TARGET.websiteDirectory), TARGET.hostDirectory);
}

async function createFreshSecretsDirectory(client) {
  await requireWebsiteDirectory(client);
  await assertSecretsDirectoryAbsentOnNas(client);

  // filesystem.put opens with wb+ and has no exclusive-create option. A fresh,
  // atomically created private child directory plus one task-owned writer is
  // the no-overwrite boundary. Never reuse or replay after an ambiguous result.
  await createPrivateDirectory(client, TARGET.hostDirectory, "new website secrets directory");
}

async function assertSecretsDirectoryEmptyOnNas(client) {
  assertSecretsDirectoryEmpty(await directoryEntries(client, TARGET.hostDirectory));
}

async function secureKeyFile(client, expectedSize) {
  const stats = async () => ({
    stat: await client.call("filesystem.stat", [TARGET.hostKey]),
    acl: await client.call("filesystem.getacl", [TARGET.hostKey, true, false]),
  });
  let current = await stats();
  if (!isRecord(current.stat) || current.stat.realpath !== TARGET.hostKey || current.stat.type !== "FILE"
      || Number(current.stat.size) !== expectedSize) fail("key upload file readback failed");
  const result = await callMutationOnce(client, "filesystem.setperm", [buildKeySetpermRequest()]);
  const jobId = extractJobId(result);
  await waitForJob(client, jobId, FILE_JOB_TIMEOUT_MS, "key permission job");
  current = await stats();
  if (!assertKeyFileMetadata(current.stat, current.acl) || Number(current.stat.size) !== expectedSize) {
    fail("owner-only website key verification failed");
  }
}

export async function connectForMode(inputs, {
  connect = connectTrueNAS,
  ensureIngestKey = () => runKeychain("ensure-ingest-key"),
  writeOutput = text => process.stdout.write(text),
} = {}) {
  if (inputs.mode !== "prepare-key") return await connect();

  const keychainStatus = await ensureIngestKey();
  if (!["created", "already-present"].includes(keychainStatus)) fail("Keychain status invalid");
  writeOutput(`${JSON.stringify({
    app: TARGET.app,
    service: TARGET.service,
    environment: TARGET.environment,
    keychainStatus,
    nasAccess: false,
  })}\n`);
  return null;
}

export async function prepareDelivery(client, { writeOutput = text => process.stdout.write(text) } = {}) {
  const { instance, config } = await readApp(client);
  if (instance.custom_app !== false || instance.version !== TARGET.catalogVersion
      || config.image?.repository !== TARGET.repository || config.image?.tag !== TARGET.sourceBaseImageTag) {
    fail("website target is not in the prepared base state");
  }
  await ensurePrivateWebsiteDirectory(client);
  await assertSecretsDirectoryAbsentOnNas(client);
  writeOutput(`${JSON.stringify({
    app: TARGET.app,
    service: TARGET.service,
    environment: TARGET.environment,
    appDirectory: { path: TARGET.websiteDirectory, uid: TARGET.uid, gid: TARGET.gid, mode: "0700", acl: "trivial" },
    secretsDirectory: "absent",
    ingestKeyAccess: false,
  })}\n`);
}

async function inspect(client, inputs) {
  const { instance, config } = await readApp(client);
  const output = projectInspection(instance, config);
  if (inputs.mode === "dry-run") {
    const desired = buildWebsiteConfig(config, inputs.image);
    output.proposed = {
      image: { repository: desired.image.repository, tag: desired.image.tag },
      environmentNames: desired.envs.map(item => item.name),
      storageMount: buildStorageMount(),
      keyPermissions: { uid: TARGET.uid, gid: TARGET.gid, mode: "0400", parentMode: "0700" },
    };
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

async function apply(client, inputs) {
  const initial = await readApp(client);
  const expected = buildWebsiteConfig(initial.config, inputs.image);
  await requireWebsiteDirectory(client);
  await assertSecretsDirectoryAbsentOnNas(client);
  const keyBytes = await runKeychain("read-ingest", { privateBytes: true });
  try {
    if (keyBytes.length === 0 || keyBytes.length > MAX_UPLOAD_BYTES
        || !/^[\x21-\x7e]+$/.test(new TextDecoder("ascii").decode(keyBytes))) fail("ingest-key data invalid");
    await createFreshSecretsDirectory(client);
    await assertSecretsDirectoryEmptyOnNas(client);
    const upload = await uploadKey(client, keyBytes);
    await secureKeyFile(client, keyBytes.length);
    const beforeSubmit = await readApp(client);
    if (!isDeepStrictEqual(initial.config, beforeSubmit.config)
        || beforeSubmit.instance.id !== initial.instance.id || beforeSubmit.instance.state !== "RUNNING"
        || beforeSubmit.instance.version !== TARGET.catalogVersion || beforeSubmit.instance.custom_app !== false) {
      fail("website config drift before update; secret file retained for manual reconciliation");
    }
    const updateResult = await callMutationOnce(client, "app.update", [TARGET.app, { values: expected }]);
    const jobId = extractJobId(updateResult);
    const job = await waitForJob(client, jobId, APP_JOB_TIMEOUT_MS, "app.update job");
    const verified = await waitForRuntime(client, expected);
    process.stdout.write(`${JSON.stringify({
      app: TARGET.app,
      version: verified.instance.version,
      state: verified.instance.state,
      service: TARGET.service,
      job,
      image: `${TARGET.repository}:${expected.image.tag}`,
      secretFile: { path: TARGET.hostKey, uid: TARGET.uid, gid: TARGET.gid, mode: "0400", mountPath: TARGET.keyTarget, readOnly: true },
      configPreserved: true,
      endpoint: TARGET.otlpEndpoint,
      protocol: "http/protobuf",
      sourceCommit: inputs.image.sourceSha,
      mutationAmbiguous: false,
      uploadJob: upload,
    })}\n`);
  } finally {
    keyBytes.fill(0);
  }
}

async function logs(client, tail) {
  const { instance } = await readApp(client);
  const container = assertWebsiteInstance(instance);
  const eventName = buildLogEventName(container.id, tail);
  const lines = [];
  let totalBytes = 0;
  const listener = message => {
    if (lines.length >= tail || totalBytes >= MAX_TOTAL_LOG_BYTES) return;
    const bounded = extractBoundedLogEntry(message, eventName, MAX_TOTAL_LOG_BYTES - totalBytes);
    if (bounded) {
      totalBytes += bounded.bytes;
      lines.push(bounded.entry);
    }
  };
  client.listeners.add(listener);
  try {
    const subscription = await client.call("core.subscribe", [eventName]);
    if (typeof subscription !== "string" || subscription.length === 0) fail("website log subscription unavailable");
    await Bun.sleep(2_000);
    await client.call("core.unsubscribe", [subscription]).catch(() => {});
  } finally {
    client.listeners.delete(listener);
  }
  process.stdout.write(`${JSON.stringify({ app: TARGET.app, service: TARGET.service, tailRequested: tail, lines })}\n`);
}

async function main(argv) {
  let inputs;
  try { inputs = parseArgs(argv); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; return; }
  if (typeof Bun === "undefined") {
    process.stderr.write("run this helper with Bun; offline pure-function tests may use Node\n");
    process.exitCode = 2;
    return;
  }
  let client = null;
  try {
    client = await connectForMode(inputs);
    if (inputs.mode === "prepare-key") return;
    if (inputs.mode === "prepare-delivery") return await prepareDelivery(client);
    if (inputs.mode === "inspect" || inputs.mode === "dry-run") return await inspect(client, inputs);
    if (inputs.mode === "apply") return await apply(client, inputs);
    if (inputs.mode === "logs") return await logs(client, inputs.tail);
  } catch (error) {
    const safe = error instanceof SafeFailure ? error : new SafeFailure("website OpenWoof operation failed", { ambiguous: true });
    const details = safe.jobId ? ` (job ${safe.jobId})` : "";
    const next = safe.ambiguous ? "; inspect TrueNAS state before retrying" : "";
    process.stderr.write(`${safe.phase}${details}${next}\n`);
    process.exitCode = 1;
  } finally {
    if (client) await client.close();
  }
}

if (import.meta.main) await main(process.argv.slice(2));
