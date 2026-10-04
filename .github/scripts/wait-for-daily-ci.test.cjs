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

function makeHarness(runResponses, { deployRun, context = makeContext() } = {}) {
  let elapsedMs = 0;
  const listCalls = [];
  const sleeps = [];
  const infos = [];
  const github = {
    rest: {
      actions: {
        getWorkflowRun: async (args) => {
          assert.deepEqual(args, { owner: OWNER, repo: REPO, run_id: context.runId });
          return {
            data: deployRun ?? makeWorkflowRun({ id: context.runId }),
          };
        },
        listWorkflowRuns: async (args) => {
          listCalls.push(args);
          return {
            data: { workflow_runs: runResponses.shift() ?? [] },
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
