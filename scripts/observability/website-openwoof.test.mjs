import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  SafeFailure,
  TARGET,
  assertDirectoryAbsent,
  assertKeyFileMetadata,
  assertPrivateDirectoryMetadata,
  assertPrivateStagingParentMetadata,
  assertRuntimeConfiguration,
  assertSecretsDirectoryEmpty,
  assertWebsiteInstance,
  boundLogEntry,
  buildKeySetpermRequest,
  buildLogEventName,
  buildManagementWebSocketOptions,
  buildPrivateDirectoryMkdirRequest,
  buildPrivateDirectorySetpermRequest,
  buildStorageMount,
  buildUploadRequest,
  buildUploadBody,
  buildWebsiteConfig,
  callMutationOnce,
  connectForMode,
  extractBoundedLogEntry,
  parseArgs,
  prepareDelivery,
  projectInspection,
  redactLogLine,
} from "./website-openwoof.mjs";

const TRUENAS_CA_FINGERPRINT = "D8:3F:04:CA:B7:DD:95:4C:9F:FA:F7:54:5F:D8:B4:7B:FA:2B:EB:15:E4:D9:EA:5C:AC:BD:A1:62:31:B5:5A:E1";

test("TrueNAS management TLS pins the current localhost CA at the fixed endpoint", async () => {
  const caPem = await readFile(new URL("./truenas-ca.pem", import.meta.url));
  const certificate = new X509Certificate(caPem);
  const now = Date.now();

  assert.equal(certificate.fingerprint256, TRUENAS_CA_FINGERPRINT);
  assert.equal(certificate.checkHost("localhost"), "localhost");
  assert.ok(Date.parse(certificate.validFrom) < now, "pinned CA must already be valid");
  assert.ok(now < Date.parse(certificate.validTo), "pinned CA must not be expired");
  assert.equal(TARGET.endpoint, "wss://192.168.0.2:8443/api/current");
  assert.equal(TARGET.origin, "https://192.168.0.2:8443");

  const websocket = buildManagementWebSocketOptions();
  assert.deepEqual(websocket.tls.ca, caPem);
  assert.equal(websocket.tls.serverName, "localhost");
  assert.equal(websocket.tls.rejectUnauthorized, true);

  const upload = buildUploadRequest(new URL("/_upload/", TARGET.origin), "c".repeat(36), 1, "fixture-token-123456");
  assert.deepEqual(upload.options.ca, caPem);
  assert.equal(upload.options.servername, "localhost");
  assert.equal(upload.options.rejectUnauthorized, true);
  assert.equal(upload.options.agent, false);
  assert.throws(() => buildUploadRequest(new URL("/_upload/", "https://192.168.0.3:8443"), "c".repeat(36), 1, "fixture-token-123456"), /endpoint guard/);
});

const SOURCE = "aaf86d9ee76a9c6ae1f18560e707aac178da46e3";
const DIGEST = `sha256:${"a".repeat(64)}`;

function appConfig(overrides = {}) {
  return {
    envs: [],
    storage: [],
    entrypoint: [],
    command: [],
    image: { repository: TARGET.repository, tag: TARGET.sourceBaseImageTag },
    ...overrides,
  };
}

function appInstance(overrides = {}) {
  return {
    id: TARGET.app,
    name: TARGET.app,
    custom_app: false,
    version: TARGET.catalogVersion,
    state: "RUNNING",
    active_workloads: {
      container_details: [{
        id: "website-container-fixture",
        service_name: TARGET.service,
        state: "running",
        image: `${TARGET.repository}:${TARGET.sourceBaseImageTag}`,
        volume_mounts: [],
      }],
    },
    ...overrides,
  };
}

test("CLI parsing requires explicit target confirmation and immutable source/image inputs", () => {
  assert.throws(() => parseArgs(["--mode", "apply", "--source-sha", SOURCE, "--image-digest", DIGEST]), /confirm website/);
  const args = parseArgs(["--mode", "apply", "--source-sha", SOURCE, "--image-digest", DIGEST, "--confirm", "website"]);
  assert.equal(args.image.sourceSha, SOURCE);
  assert.equal(args.image.imageTag, `main-${SOURCE.slice(0, 7)}@${DIGEST}`);
  assert.equal(parseArgs(["--mode", "prepare-key"]).mode, "prepare-key");
  assert.equal(parseArgs(["--mode", "prepare-delivery"]).mode, "prepare-delivery");
  assert.throws(() => parseArgs(["--mode", "prepare-key", "--prepared", "website"]), /usage/);
  assert.throws(() => parseArgs(["--mode", "logs", "--tail", "201"]), /1 to 200/);
});

test("prepare-key is local-only and reports only nonsecret target and Keychain status", async () => {
  let connectCalls = 0;
  let ensureCalls = 0;
  const output = [];
  const client = await connectForMode(parseArgs(["--mode", "prepare-key"]), {
    connect: async () => { connectCalls += 1; throw new Error("NAS connection must not be attempted"); },
    ensureIngestKey: async () => { ensureCalls += 1; return "created"; },
    writeOutput: text => output.push(text),
  });

  assert.equal(client, null);
  assert.equal(connectCalls, 0);
  assert.equal(ensureCalls, 1);
  assert.deepEqual(JSON.parse(output.join("")), {
    app: "website",
    service: "website",
    environment: "production",
    keychainStatus: "created",
    nasAccess: false,
  });
});

test("prepare-key validates the stubbed local Keychain status without connecting", async () => {
  let connectCalls = 0;
  for (const status of ["already-present"]) {
    const output = [];
    await connectForMode(parseArgs(["--mode", "prepare-key"]), {
      connect: async () => { connectCalls += 1; throw new Error("NAS connection must not be attempted"); },
      ensureIngestKey: async () => status,
      writeOutput: text => output.push(text),
    });
    assert.equal(JSON.parse(output.join("")).keychainStatus, status);
  }
  await assert.rejects(connectForMode(parseArgs(["--mode", "prepare-key"]), {
    connect: async () => { connectCalls += 1; throw new Error("NAS connection must not be attempted"); },
    ensureIngestKey: async () => "unexpected-status",
    writeOutput: () => assert.fail("invalid status must not be reported as success"),
  }), error => error instanceof SafeFailure && error.phase === "Keychain status invalid");
  assert.equal(connectCalls, 0);
});

test("prepare-delivery connects for NAS staging without reading the ingest Keychain item", async () => {
  const client = {};
  let connectCalls = 0;
  let ingestKeyCalls = 0;
  const result = await connectForMode(parseArgs(["--mode", "prepare-delivery"]), {
    connect: async () => { connectCalls += 1; return client; },
    ensureIngestKey: async () => { ingestKeyCalls += 1; throw new Error("ingest Keychain setup must not run"); },
  });
  assert.equal(result, client);
  assert.equal(connectCalls, 1);
  assert.equal(ingestKeyCalls, 0);
});

test("target guard rejects a custom app, wrong catalogue version, stopped app, or service drift", () => {
  assert.equal(assertWebsiteInstance(appInstance()).id, "website-container-fixture");
  assert.throws(() => assertWebsiteInstance(appInstance({ custom_app: true })), SafeFailure);
  assert.throws(() => assertWebsiteInstance(appInstance({ version: "1.4.5" })), SafeFailure);
  assert.throws(() => assertWebsiteInstance(appInstance({ state: "STOPPED" })), SafeFailure);
  assert.throws(() => assertWebsiteInstance(appInstance({ active_workloads: { container_details: [] } })), SafeFailure);
  assert.throws(() => assertWebsiteInstance(appInstance({ active_workloads: null })), SafeFailure);
});

test("catalogue update preserves unrelated values and changes only telemetry, image tag, and key mount", () => {
  const current = appConfig({
    envs: [{ name: "SPRING_PROFILES_ACTIVE", value: "production" }],
    storage: [{ type: "ix_volume", mount_path: "/data", ix_volume_config: { dataset_name: "website-data" } }],
    entrypoint: ["/custom-entrypoint"],
    command: ["--existing"],
    image: { repository: TARGET.repository, tag: TARGET.sourceBaseImageTag, pull_policy: "always" },
    service_port: 8888,
  });
  const before = structuredClone(current);
  const next = buildWebsiteConfig(current, { sourceSha: SOURCE, digest: DIGEST });
  assert.deepEqual(current, before);
  assert.deepEqual(next.entrypoint, before.entrypoint);
  assert.deepEqual(next.command, before.command);
  assert.deepEqual(next.storage[0], before.storage[0]);
  assert.equal(next.service_port, 8888);
  assert.deepEqual(next.image, { ...before.image, tag: `main-${SOURCE.slice(0, 7)}@${DIGEST}` });
  assert.deepEqual(next.envs.find(item => item.name === "SPRING_PROFILES_ACTIVE"), before.envs[0]);
  assert.equal(next.storage.filter(item => item.mount_path === TARGET.keyTarget).length, 1);
  assert.throws(() => buildWebsiteConfig(appConfig({ image: { repository: TARGET.repository, tag: "latest" } }), { sourceSha: SOURCE, digest: DIGEST }), /image tag changed/);
  const alternateDigest = `latest@sha256:${"b".repeat(64)}`;
  assert.throws(() => buildWebsiteConfig(appConfig({ image: { repository: TARGET.repository, tag: alternateDigest } }), { sourceSha: SOURCE, digest: DIGEST }), /image tag changed/);
});

test("inherited endpoint, header, protocol and legacy OpenWoof credentials are cleared", () => {
  const next = buildWebsiteConfig(appConfig({ envs: [
    { name: "OTEL_EXPORTER_OTLP_ENDPOINT", value: "http://old-collector:4318" },
    { name: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", value: "http://old-collector:4318/v1/traces" },
    { name: "OTEL_EXPORTER_OTLP_PROTOCOL", value: "grpc" },
    { name: "OTEL_EXPORTER_OTLP_TRACES_HEADERS", value: "Authorization=Bearer fixture" },
    { name: "OTEL_EXPORTER_OTLP_CLIENT_KEY", value: "/old/key" },
    { name: "OTEL_EXPORTER_OTLP_TRACES_INSECURE", value: "true" },
    { name: "OTEL_EXPORTER_OTLP_BEARER_TOKEN", value: "fixture-otel-token" },
    { name: "OTEL_EXPORTER_OTLP_AUTHORIZATION", value: "Bearer fixture-authorization" },
    { name: "OPENWOOF_INGEST_KEY", value: "fixture-ingest-key" },
    { name: "OPENWOOF_API_TOKEN", value: "fixture-api-token" },
  ] }), { sourceSha: SOURCE, digest: DIGEST });
  const env = Object.fromEntries(next.envs.map(item => [item.name, item.value]));
  assert.equal(env.OPENWOOF_INGEST_KEY_FILE, TARGET.keyTarget);
  assert.equal(env.OPENWOOF_TELEMETRY_ENABLED, "true");
  assert.equal(env.OTEL_EXPORTER_OTLP_ENDPOINT, TARGET.otlpEndpoint);
  assert.equal(env.OTEL_EXPORTER_OTLP_PROTOCOL, "http/protobuf");
  assert.equal(env.OTEL_EXPORTER_OTLP_HEADERS, "");
  assert.equal(env.OTEL_SERVICE_NAME, "website-backend");
  assert.equal(env.QB_SOURCE_COMMIT, SOURCE);
  assert.equal(env.OTEL_RESOURCE_ATTRIBUTES, `service.namespace=personal-website,deployment.environment.name=production,service.version=${SOURCE}`);
  assert.equal(Object.keys(env).filter(name => name === "OTEL_EXPORTER_OTLP_HEADERS").length, 1);
  for (const name of ["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "OTEL_EXPORTER_OTLP_TRACES_HEADERS", "OTEL_EXPORTER_OTLP_CLIENT_KEY", "OTEL_EXPORTER_OTLP_TRACES_INSECURE", "OTEL_EXPORTER_OTLP_BEARER_TOKEN", "OTEL_EXPORTER_OTLP_AUTHORIZATION", "OPENWOOF_INGEST_KEY", "OPENWOOF_API_TOKEN"]) {
    assert.equal(Object.hasOwn(env, name), false, `${name} must be removed`);
  }
  assert.equal(JSON.stringify(next).includes("fixture-ingest-key"), false);
  assert.equal(JSON.stringify(next).includes("fixture-api-token"), false);
  assert.equal(JSON.stringify(next).includes("fixture-otel-token"), false);
  assert.equal(JSON.stringify(next).includes("fixture-authorization"), false);
});

test("secret delivery creates only fresh private directories and preserves unknown contents", () => {
  assert.equal(TARGET.websiteParentDirectory, "/mnt/Lake");
  assert.equal(TARGET.websiteDirectory, "/mnt/Lake/website-openwoof");
  assert.equal(TARGET.hostDirectory, "/mnt/Lake/website-openwoof/secrets");
  assert.equal(TARGET.hostKey, "/mnt/Lake/website-openwoof/secrets/openwoof-ingest.key");
  assert.equal(assertDirectoryAbsent([], TARGET.hostDirectory), true);
  assert.throws(() => assertDirectoryAbsent([{ name: "secrets", type: "DIRECTORY" }], TARGET.hostDirectory), /already exists/);
  assert.throws(() => assertDirectoryAbsent([{ path: TARGET.hostDirectory, type: "FILE" }], TARGET.hostDirectory), /already exists/);
  assert.equal(assertSecretsDirectoryEmpty([]), true);
  assert.throws(() => assertSecretsDirectoryEmpty([{ name: "unrelated.txt", type: "FILE" }]), /unknown entries/);

  const directory = { realpath: TARGET.websiteDirectory, type: "DIRECTORY", uid: TARGET.uid, gid: TARGET.gid, mode: 0o40700 };
  const acl = { path: TARGET.websiteDirectory, trivial: true };
  assert.equal(assertPrivateDirectoryMetadata(directory, acl, TARGET.websiteDirectory), true);
  assert.equal(assertPrivateDirectoryMetadata({ ...directory, uid: 0 }, acl, TARGET.websiteDirectory), false);
  assert.equal(assertPrivateDirectoryMetadata({ ...directory, gid: 0 }, acl, TARGET.websiteDirectory), false);
  assert.equal(assertPrivateDirectoryMetadata({ ...directory, mode: 0o40755 }, acl, TARGET.websiteDirectory), false);
  assert.equal(assertPrivateDirectoryMetadata(directory, { ...acl, trivial: false }, TARGET.websiteDirectory), false);

  const parentStat = { realpath: TARGET.websiteParentDirectory, type: "DIRECTORY", uid: 0, gid: 0, mode: 0o40755 };
  const parentAcl = { path: TARGET.websiteParentDirectory, acltype: "POSIX1E", trivial: true };
  assert.equal(assertPrivateStagingParentMetadata(parentStat, parentAcl), true);
  assert.equal(assertPrivateStagingParentMetadata({ ...parentStat, realpath: "/mnt/other" }, parentAcl), false);
  assert.equal(assertPrivateStagingParentMetadata({ ...parentStat, type: "SYMLINK" }, parentAcl), false);
  assert.equal(assertPrivateStagingParentMetadata({ ...parentStat, uid: 1001 }, parentAcl), false);
  assert.equal(assertPrivateStagingParentMetadata({ ...parentStat, mode: 0o40775 }, parentAcl), false);
  assert.equal(assertPrivateStagingParentMetadata({ ...parentStat, mode: undefined }, parentAcl), false);
  assert.equal(assertPrivateStagingParentMetadata({ ...parentStat, mode: "invalid" }, parentAcl), false);
  assert.equal(assertPrivateStagingParentMetadata(parentStat, { ...parentAcl, acltype: "NFS4" }), false);
  assert.equal(assertPrivateStagingParentMetadata(parentStat, { ...parentAcl, trivial: false }), false);

  assert.deepEqual(buildPrivateDirectoryMkdirRequest(TARGET.websiteDirectory), {
    path: TARGET.websiteDirectory, options: { mode: "700", raise_chmod_error: true },
  });
  assert.deepEqual(buildPrivateDirectoryMkdirRequest(TARGET.hostDirectory), {
    path: TARGET.hostDirectory, options: { mode: "700", raise_chmod_error: true },
  });
  assert.deepEqual(buildPrivateDirectorySetpermRequest(TARGET.websiteDirectory), {
    path: TARGET.websiteDirectory, uid: 1001, gid: 1001, mode: "700",
    options: { recursive: false, traverse: false, stripacl: true },
  });
  assert.deepEqual(buildPrivateDirectorySetpermRequest(TARGET.hostDirectory), {
    path: TARGET.hostDirectory, uid: 1001, gid: 1001, mode: "700",
    options: { recursive: false, traverse: false, stripacl: true },
  });
  assert.throws(() => buildPrivateDirectorySetpermRequest("/mnt/Lake/Data"), /invalid/);

  // The fresh directory and upload must have one task-owned writer; filesystem.put has no O_EXCL.
});

test("prepare-delivery stages only the scoped UID 1001 app directory", async () => {
  const calls = [];
  const client = {
    async call(method, params) {
      calls.push({ method, params });
      if (method === "app.get_instance") return appInstance();
      if (method === "app.config") return appConfig();
      if (method === "filesystem.listdir" && params[0] === "/mnt/Lake") return [];
      if (method === "filesystem.listdir" && params[0] === TARGET.websiteDirectory) return [];
      if (method === "filesystem.mkdir") return { path: params[0].path };
      if (method === "filesystem.setperm") return { id: 71 };
      if (method === "core.get_jobs") return [{ id: 71, state: "SUCCESS" }];
      if (method === "filesystem.stat" && params[0] === TARGET.websiteParentDirectory) return {
        realpath: TARGET.websiteParentDirectory, type: "DIRECTORY", uid: 0, gid: 0, mode: 0o40755,
      };
      if (method === "filesystem.getacl" && params[0] === TARGET.websiteParentDirectory) return {
        path: TARGET.websiteParentDirectory, acltype: "POSIX1E", trivial: true,
      };
      if (method === "filesystem.stat") return {
        realpath: TARGET.websiteDirectory, type: "DIRECTORY", uid: TARGET.uid, gid: TARGET.gid, mode: 0o40700,
      };
      if (method === "filesystem.getacl") return { path: params[0], trivial: true };
      assert.fail(`unexpected NAS method ${method}`);
    },
  };
  const output = [];
  await prepareDelivery(client, { writeOutput: text => output.push(text) });

  assert.deepEqual(JSON.parse(output.join("")), {
    app: "website",
    service: "website",
    environment: "production",
    appDirectory: { path: "/mnt/Lake/website-openwoof", uid: 1001, gid: 1001, mode: "0700", acl: "trivial" },
    secretsDirectory: "absent",
    ingestKeyAccess: false,
  });
  assert.equal(calls.some(({ method }) => method === "filesystem.put" || method === "app.update"), false);
  assert.deepEqual(calls.find(({ method }) => method === "filesystem.mkdir").params[0], {
    path: TARGET.websiteDirectory,
    options: { mode: "700", raise_chmod_error: true },
  });
  assert.deepEqual(calls.find(({ method }) => method === "filesystem.setperm").params[0], {
    path: TARGET.websiteDirectory,
    uid: 1001,
    gid: 1001,
    mode: "700",
    options: { recursive: false, traverse: false, stripacl: true },
  });
  assert.equal(calls.some(({ method, params }) => method === "filesystem.listdir" && params[0] === "/mnt/Lake/Data"), false);
  assert.equal(calls.some(({ method, params }) => method === "filesystem.setperm" && params[0].path === TARGET.websiteParentDirectory), false);
});

test("prepare-delivery refuses existing secrets, base-state drift, and parent ACL drift before mutation", async () => {
  async function runFixture({ existingSecrets = false, imageTag = TARGET.sourceBaseImageTag, parentMode = 0o40755, parentAcltype = "POSIX1E" } = {}) {
    const calls = [];
    const client = {
      async call(method, params) {
        calls.push({ method, params });
        if (method === "app.get_instance") return appInstance();
        if (method === "app.config") return appConfig({ image: { repository: TARGET.repository, tag: imageTag } });
        if (method === "filesystem.listdir" && params[0] === "/mnt/Lake") {
          return [{ name: "website-openwoof", path: TARGET.websiteDirectory }];
        }
        if (method === "filesystem.listdir" && params[0] === TARGET.websiteDirectory) {
          return existingSecrets ? [{ name: "secrets", type: "DIRECTORY", path: TARGET.hostDirectory }] : [];
        }
        if (method === "filesystem.stat" && params[0] === TARGET.websiteParentDirectory) return {
          realpath: TARGET.websiteParentDirectory, type: "DIRECTORY", uid: 0, gid: 0, mode: parentMode,
        };
        if (method === "filesystem.getacl" && params[0] === TARGET.websiteParentDirectory) return {
          path: TARGET.websiteParentDirectory, acltype: parentAcltype, trivial: true,
        };
        if (method === "filesystem.stat") return {
          realpath: TARGET.websiteDirectory, type: "DIRECTORY", uid: TARGET.uid, gid: TARGET.gid, mode: 0o40700,
        };
        if (method === "filesystem.getacl") return { path: params[0], trivial: true };
        assert.fail(`unexpected NAS method ${method}`);
      },
    };
    return { client, calls };
  }

  const existing = await runFixture({ existingSecrets: true });
  await assert.rejects(prepareDelivery(existing.client, { writeOutput: () => assert.fail("refused staging must not report success") }), /already exists/);
  assert.equal(existing.calls.some(({ method }) => method === "filesystem.mkdir" || method === "filesystem.setperm"), false);

  const drifted = await runFixture({ imageTag: "latest" });
  await assert.rejects(prepareDelivery(drifted.client, { writeOutput: () => assert.fail("drifted target must not report success") }), /prepared base state/);
  assert.equal(drifted.calls.some(({ method }) => method.startsWith("filesystem.")), false);

  const unsafeParent = await runFixture({ parentMode: 0o40775 });
  await assert.rejects(prepareDelivery(unsafeParent.client, { writeOutput: () => assert.fail("unsafe parent must not report success") }), /staging parent changed/);
  assert.equal(unsafeParent.calls.some(({ method }) => method === "filesystem.listdir" || method === "filesystem.mkdir" || method === "filesystem.setperm"), false);

  const unexpectedAcl = await runFixture({ parentAcltype: "NFS4" });
  await assert.rejects(prepareDelivery(unexpectedAcl.client, { writeOutput: () => assert.fail("unexpected parent ACL must not report success") }), /staging parent changed/);
  assert.equal(unexpectedAcl.calls.some(({ method }) => method === "filesystem.listdir" || method === "filesystem.mkdir" || method === "filesystem.setperm"), false);
});

test("secret mount and file permissions are exact and owner-only", () => {
  assert.deepEqual(buildStorageMount(), {
    type: "host_path",
    read_only: true,
    mount_path: TARGET.keyTarget,
    host_path_config: { path: TARGET.hostKey, acl_enable: false },
  });
  assert.deepEqual(buildKeySetpermRequest(), {
    path: TARGET.hostKey,
    uid: 1001,
    gid: 1001,
    mode: "400",
    options: { recursive: false, traverse: false, stripacl: true },
  });
  assert.equal(assertKeyFileMetadata({ realpath: TARGET.hostKey, type: "FILE", size: 68, uid: 1001, gid: 1001, mode: 0o100400 }, { path: TARGET.hostKey, trivial: true }), true);
  assert.equal(assertKeyFileMetadata({ realpath: TARGET.hostKey, type: "FILE", size: 68, uid: 1001, gid: 1001, mode: 0o100440 }, { path: TARGET.hostKey, trivial: true }), false);
  assert.equal(assertKeyFileMetadata({ realpath: TARGET.hostKey, type: "FILE", size: 68, uid: 0, gid: 0, mode: 0o100400 }, { path: TARGET.hostKey, trivial: true }), false);
});

test("inspection emits only whitelisted metadata and never app environment values", () => {
  const secretCanary = "fixture-never-output-secret-value";
  const projected = projectInspection(appInstance(), appConfig({ envs: [{ name: "SOME_SECRET", value: secretCanary }] }));
  const text = JSON.stringify(projected);
  assert.equal(text.includes(secretCanary), false);
  assert.equal(text.includes("SOME_SECRET"), true);
  assert.deepEqual(projected.schemaWhitelist.image.pull_policy, ["missing", "always", "never"]);
});

test("runtime readback requires exact app configuration and read-only bind mount", () => {
  const expected = buildWebsiteConfig(appConfig(), { sourceSha: SOURCE, digest: DIGEST });
  const instance = appInstance({ active_workloads: { container_details: [{
    id: "website-container-fixture",
    service_name: TARGET.service,
    state: "running",
    image: `${TARGET.repository}:${expected.image.tag}`,
    volume_mounts: [{ source: TARGET.hostKey, destination: TARGET.keyTarget, mode: "ro", type: "bind" }],
  }] } });
  assert.equal(assertRuntimeConfiguration(instance, expected, expected, instance.active_workloads.container_details[0]), true);
  const digestOnly = structuredClone(instance);
  digestOnly.active_workloads.container_details[0].image = `${TARGET.repository}@${DIGEST}`;
  assert.equal(assertRuntimeConfiguration(digestOnly, expected, expected, digestOnly.active_workloads.container_details[0]), true);
  const imageWithUntrustedSuffix = structuredClone(instance);
  imageWithUntrustedSuffix.active_workloads.container_details[0].image = `${TARGET.repository}:${expected.image.tag}.untrusted`;
  assert.throws(() => assertRuntimeConfiguration(imageWithUntrustedSuffix, expected, expected, imageWithUntrustedSuffix.active_workloads.container_details[0]), /container identity/);
  const wrongMount = structuredClone(instance);
  wrongMount.active_workloads.container_details[0].volume_mounts[0].mode = "rw";
  assert.throws(() => assertRuntimeConfiguration(wrongMount, expected, expected, wrongMount.active_workloads.container_details[0]), /read-only/);
});

test("uncertain mutations are issued once and marked ambiguous", async () => {
  let calls = 0;
  const client = { async call() { calls += 1; throw new Error("transport closed"); } };
  await assert.rejects(callMutationOnce(client, "app.update", [TARGET.app, { values: {} }]), error => {
    assert.equal(error instanceof SafeFailure, true);
    assert.equal(error.ambiguous, true);
    assert.match(error.phase, /before any retry/);
    return true;
  });
  assert.equal(calls, 1);
});

test("log event is app and container scoped, bounded, and redacted", () => {
  const eventName = buildLogEventName("container-1", 25);
  assert.equal(eventName, 'app.container_log_follow:{"app_name":"website","container_id":"container-1","tail_lines":25}');
  assert.throws(() => buildLogEventName("container-1", null), /invalid/);

  const event = {
    method: "collection_update",
    params: { msg: "added", collection: eventName, fields: { data: "token=fixture", timestamp: "2026-10-20T12:00:00Z" } },
  };
  assert.deepEqual(extractBoundedLogEntry(event, eventName, 100), {
    entry: { timestamp: "2026-10-20T12:00:00Z", line: "token=[REDACTED]" },
    bytes: Buffer.byteLength("2026-10-20T12:00:00Ztoken=[REDACTED]", "utf8"),
  });
  assert.notEqual(extractBoundedLogEntry({ ...event, params: { ...event.params, msg: "ADDED" } }, eventName, 100), null);
  assert.equal(extractBoundedLogEntry({ ...event, params: { ...event.params, msg: "removed" } }, eventName, 100), null);
  assert.equal(extractBoundedLogEntry({ ...event, params: { ...event.params, collection: "other" } }, eventName, 100), null);
  assert.equal(extractBoundedLogEntry({ method: "notify_unsubscribed", params: { collection: eventName } }, eventName, 100), null);

  const line = redactLogLine("authorization: Bearer abc.def token=xyz email josh@example.com ip=192.168.0.2 phone=248-555-0199");
  assert.equal(line.includes("abc.def"), false);
  assert.equal(line.includes("xyz"), false);
  assert.equal(line.includes("josh@example.com"), false);
  assert.equal(line.includes("192.168.0.2"), false);
  assert.equal(line.includes("248-555-0199"), false);

  const bounded = boundLogEntry("🙂".repeat(200), "t".repeat(200), 100);
  assert.equal(bounded.entry.timestamp.length, 64);
  assert.ok(Buffer.byteLength(bounded.entry.line, "utf8") <= 100 - Buffer.byteLength(bounded.entry.timestamp, "utf8"));
  assert.ok(bounded.bytes <= 100);
  assert.equal(boundLogEntry("ignored", "x".repeat(100), 10), null);
});

test("upload is bounded to the exact NAS path and carries create mode without logging the payload", () => {
  const fixture = new TextEncoder().encode("fixture-only-ingest-key");
  const boundary = "b".repeat(36);
  const upload = buildUploadBody(TARGET.hostKey, fixture, boundary);
  const body = upload.body.toString("utf8");
  assert.match(body, /filesystem\.put/);
  assert.match(body, /openwoof-ingest\.key/);
  assert.match(body, /"mode":256/);
  assert.match(body, /fixture-only-ingest-key/);
  assert.throws(() => buildUploadBody("/tmp/other", fixture, "b".repeat(36)), /bounded/);

  const fixtureToken = "fixture-token-123456";
  const request = buildUploadRequest(new URL("/_upload/", TARGET.origin), boundary, upload.body.length, fixtureToken);
  assert.equal(request.url, `${TARGET.origin}/_upload/`);
  assert.equal(new URL(request.url).search, "");
  assert.equal(request.url.includes(fixtureToken), false);
  assert.equal(request.options.headers.authorization, `Token ${fixtureToken}`);
  assert.equal(request.options.headers["content-type"], `multipart/form-data; boundary=${boundary}`);
  assert.equal(request.options.headers["content-length"], String(upload.body.length));
  assert.throws(() => buildUploadRequest(new URL(`/_upload/?auth_token=${fixtureToken}`, TARGET.origin), boundary, upload.body.length, fixtureToken), /endpoint guard/);
  assert.throws(() => buildUploadRequest(new URL("/_upload/?", TARGET.origin), boundary, upload.body.length, fixtureToken), /endpoint guard/);
  assert.throws(() => buildUploadRequest(new URL("/_upload/", TARGET.origin), boundary, upload.body.length, "bad\r\nheader"), /bounded/);

  upload.body.fill(0);
  fixture.fill(0);
});

test("Swift bridge prompts securely, stores add-only, and has no shell-output prompt path", async () => {
  const swift = await readFile(new URL("./website-keychain.swift", import.meta.url), "utf8");
  assert.match(swift, /NSSecureTextField/);
  assert.match(swift, /SecItemAdd/);
  assert.match(swift, /SecItemCopyMatching/);
  assert.doesNotMatch(swift, /SecItemUpdate|osascript|Process\s*\(/);
  assert.match(swift, /--private-fd/);
  assert.match(swift, /secretPipeType == S_IFIFO \|\| secretPipeType == S_IFSOCK/);
  assert.match(swift, /descriptorFlags = fcntl\(privateSecretFileDescriptor, F_GETFL\)/);
  assert.match(swift, /accessMode == O_WRONLY \|\| \(isSocket && accessMode == O_RDWR\)/);
  assert.match(swift, /socketType == SOCK_STREAM/);
  assert.match(swift, /--test-fd3/);
  assert.match(swift, /FileHandle\(fileDescriptor: privateSecretFileDescriptor, closeOnDealloc: false\)\.write\(bytes\)/);
  assert.doesNotMatch(swift, /FileHandle\.standardOutput\.write\(bytes\)/);
  assert.match(swift, /openwoof\/openwoof\.javadevjt\.tech\/truenas\/website\/production/);
  assert.match(swift, /website-backend/);
});

test("Swift private fd3 guard transports a fixed synthetic marker through the Bun parent without Keychain access", async context => {
  if (process.platform !== "darwin") {
    context.skip("the native AppKit helper runs on macOS");
    return;
  }
  const helper = fileURLToPath(new URL("./website-keychain.swift", import.meta.url));
  const moduleCache = await mkdtemp(join(tmpdir(), "website-openwoof-swift-modulecache-"));
  const harness = [
    'import { spawn } from "node:child_process";',
    'const child = spawn("swift", ["-module-cache-path", process.env.WEBSITE_SWIFT_MODULECACHE, process.env.WEBSITE_KEYCHAIN_HELPER, "--test-fd3", "--private-fd", "3"], { stdio: ["ignore", "ignore", "pipe", "pipe"] });',
    "const data = [];",
    "const errors = [];",
    'child.stdio[3].on("data", chunk => data.push(Buffer.from(chunk)));',
    'child.stderr.on("data", chunk => errors.push(Buffer.from(chunk)));',
    'child.once("error", error => { process.stderr.write(error.message); process.exitCode = 1; });',
    'child.once("close", (code, signal) => {',
    '  process.stdout.write(JSON.stringify({ code, signal, marker: Buffer.concat(data).toString("utf8") }));',
    '  process.stderr.write(Buffer.concat(errors).toString("utf8"));',
    "  if (code !== 0) process.exitCode = 1;",
    "});",
  ].join("\n");
  let output = [];
  let errors = [];
  let result;
  try {
    const child = spawn("bun", ["-e", harness], {
      env: {
        ...process.env,
        WEBSITE_KEYCHAIN_HELPER: helper,
        WEBSITE_SWIFT_MODULECACHE: moduleCache,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", chunk => output.push(Buffer.from(chunk)));
    child.stderr.on("data", chunk => errors.push(Buffer.from(chunk)));
    const closed = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    const timeout = setTimeout(() => child.kill("SIGKILL"), 30_000);
    result = await closed;
    clearTimeout(timeout);
  } finally {
    await rm(moduleCache, { recursive: true, force: true });
  }
  assert.equal(result.code, 0, Buffer.concat(errors).toString("utf8") || "Bun fd3 harness should exit successfully");
  assert.equal(result.signal, null);
  const report = JSON.parse(Buffer.concat(output).toString("utf8"));
  assert.equal(report.code, 0, Buffer.concat(errors).toString("utf8") || "Swift fd3 helper should exit successfully");
  assert.equal(report.signal, null);
  assert.equal(report.marker, "synthetic-website-keychain-fd3");
});
