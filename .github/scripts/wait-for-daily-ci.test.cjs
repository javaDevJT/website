'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { waitForDailyCI } = require('./wait-for-daily-ci.cjs');

const OWNER = 'example-owner';
const REPO = 'website';
const FULL_NAME = `${OWNER}/${REPO}`;
const SHA = 'a'.repeat(40);
const DETROIT_DAY = '2026-10-04';

function makeContext(overrides = {}) {
  return {
    eventName: 'schedule',
    ref: 'refs/heads/main',
    sha: SHA,
    runId: 17,
    repo: { owner: OWNER, repo: REPO },
    ...overrides,
  };
}

function makeWorkflowRun(overrides = {}) {
  return {
    id: 41,
    event: 'schedule',
    head_branch: 'main',
    head_sha: SHA,
    head_repository: { full_name: FULL_NAME },
    repository: { full_name: FULL_NAME },
    created_at: '2026-10-04T08:05:00Z',
    status: 'completed',
    conclusion: 'success',
    ...overrides,
  };
}

function makeHarness(runResponses, { deployRun, deployErrors = [], context = makeContext() } = {}) {
  let elapsedMs = 0;
  const listCalls = [];
  const sleeps = [];
  const infos = [];
  const github = {
    rest: {
      actions: {
        getWorkflowRun: async (args) => {
          assert.deepEqual(args, { owner: OWNER, repo: REPO, run_id: context.runId });
          if (deployErrors.length) throw deployErrors.shift();
          return {
            data: deployRun ?? makeWorkflowRun({ id: context.runId }),
          };
        },
        listWorkflowRuns: async (args) => {
          listCalls.push(args);
          const response = runResponses.shift() ?? [];
          if (response instanceof Error) throw response;
          return {
            data: { workflow_runs: response },
          };
        },
      },
    },
  };

  return {
    args: {
      github,
      context,
      core: { info: (message) => infos.push(message) },
      now: () => elapsedMs,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        elapsedMs += milliseconds;
      },
    },
    infos,
    listCalls,
    sleeps,
    advance: (milliseconds) => { elapsedMs += milliseconds; },
  };
}

test('waits for the same-day scheduled CI run for the deploy SHA and reports its run ID', async () => {
  const harness = makeHarness([
    [],
    [makeWorkflowRun({ status: 'in_progress', conclusion: null })],
    [makeWorkflowRun()],
  ]);

  const result = await waitForDailyCI({
    ...harness.args,
    timeoutMs: 100,
    pollIntervalMs: 20,
  });

  assert.deepEqual(result, { runId: 41, scheduledDate: DETROIT_DAY });
  assert.deepEqual(harness.sleeps, [20, 20]);
  assert.deepEqual(harness.infos, [`Verified scheduled CI run 41 for ${DETROIT_DAY}.`]);
  assert.equal(harness.listCalls.length, 3);
  assert.deepEqual(harness.listCalls[0], {
    owner: OWNER,
    repo: REPO,
    workflow_id: 'ci.yml',
    event: 'schedule',
    branch: 'main',
    per_page: 100,
  });
});

test('fails closed when the matching scheduled CI run completed unsuccessfully', async () => {
  const harness = makeHarness([
    [makeWorkflowRun({ conclusion: 'failure' })],
  ]);

  await assert.rejects(
    waitForDailyCI(harness.args),
    /Scheduled CI run 41 completed with conclusion failure; refusing deployment/,
  );
  assert.equal(harness.listCalls.length, 1);
  assert.deepEqual(harness.infos, []);
});

test('does not accept a different SHA, event, head repository, or Detroit calendar day', async () => {
  const mismatches = [
    makeWorkflowRun({ head_sha: 'b'.repeat(40) }),
    makeWorkflowRun({ event: 'push' }),
    makeWorkflowRun({ head_repository: { full_name: 'fork/website' } }),
    // 03:59Z is still October 3 in Detroit, although UTC has reached October 4.
    makeWorkflowRun({ created_at: '2026-10-04T03:59:00Z' }),
  ];
  const harness = makeHarness([mismatches]);

  await assert.rejects(
    waitForDailyCI({ ...harness.args, timeoutMs: 0 }),
    /Timed out after 0ms waiting for scheduled CI on 2026-10-04; refusing deployment/,
  );
  assert.equal(harness.listCalls.length, 1);
  assert.deepEqual(harness.infos, []);
});

test('bounds polling by the timeout and shortens the final sleep to the remaining time', async () => {
  const harness = makeHarness([]);

  await assert.rejects(
    waitForDailyCI({
      ...harness.args,
      timeoutMs: 45,
      pollIntervalMs: 20,
    }),
    /Timed out after 45ms waiting for scheduled CI on 2026-10-04; refusing deployment/,
  );

  assert.deepEqual(harness.sleeps, [20, 20, 5]);
  assert.equal(harness.listCalls.length, 4);
  assert.equal(harness.args.now(), 45);
  assert.deepEqual(harness.infos, []);
});

function temporaryDnsError() {
  return new Error('GitHub request failed', {
    cause: new TypeError('fetch failed', {
      cause: Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' }),
    }),
  });
}

test('retries temporary DNS failures in both deployment and CI reads before verifying CI', async () => {
  const harness = makeHarness(
    [temporaryDnsError(), [makeWorkflowRun()]],
    { deployErrors: [temporaryDnsError()] },
  );

  const result = await waitForDailyCI({
    ...harness.args,
    timeoutMs: 100,
    pollIntervalMs: 20,
  });

  assert.deepEqual(result, { runId: 41, scheduledDate: DETROIT_DAY });
  assert.deepEqual(harness.sleeps, [20, 20]);
  assert.equal(harness.listCalls.length, 2);
});

test('temporary API failures share the polling deadline and cannot authorize publication', async () => {
  const harness = makeHarness([
    temporaryDnsError(), temporaryDnsError(), temporaryDnsError(), [makeWorkflowRun()],
  ]);

  await assert.rejects(
    waitForDailyCI({ ...harness.args, timeoutMs: 45, pollIntervalMs: 20 }),
    /Timed out.*GitHub.*refusing deployment/,
  );
  assert.deepEqual(harness.sleeps, [20, 20, 5]);
  assert.equal(harness.listCalls.length, 3);
  assert.equal(harness.args.now(), 45);
  assert.equal(harness.infos.some((message) => message.startsWith('Verified')), false);
});

test('rejects a successful GitHub response that arrives after the wait deadline', async () => {
  const harness = makeHarness([[makeWorkflowRun()]]);
  const originalRead = harness.args.github.rest.actions.listWorkflowRuns;
  harness.args.github.rest.actions.listWorkflowRuns = async (args) => {
    const response = await originalRead(args);
    harness.advance(46);
    return response;
  };

  await assert.rejects(
    waitForDailyCI({ ...harness.args, timeoutMs: 45, pollIntervalMs: 20 }),
    /Timed out.*GitHub.*refusing deployment/,
  );
  assert.equal(harness.infos.some((message) => message.startsWith('Verified')), false);
});

test('retries temporary server errors but still rejects an unsuccessful scheduled CI run', async () => {
  const error = Object.assign(new Error('Bad Gateway'), { status: 502 });
  const harness = makeHarness([error, [makeWorkflowRun({ conclusion: 'failure' })]]);

  await assert.rejects(
    waitForDailyCI({ ...harness.args, timeoutMs: 100, pollIntervalMs: 20 }),
    /Scheduled CI run 41 completed with conclusion failure; refusing deployment/,
  );
  assert.deepEqual(harness.sleeps, [20]);
});

test('does not retry authentication, authorization, not-found, or unknown request failures', async () => {
  for (const status of [401, 403, 404, undefined]) {
    const error = Object.assign(new Error('permanent request failure'), { status });
    const harness = makeHarness([error]);
    await assert.rejects(waitForDailyCI(harness.args), (actual) => actual === error);
    assert.deepEqual(harness.sleeps, []);
    assert.equal(harness.listCalls.length, 1);
  }
});
