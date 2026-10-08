'use strict';

const { performance } = require('node:perf_hooks');

const DETROIT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 20 * 1000;
const TEMPORARY_NETWORK_ERRORS = new Set(['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT']);

function retryableReadFailure(error) {
  if ([500, 502, 503, 504].includes(error?.status)) return `HTTP ${error.status}`;

  const visited = new Set();
  for (let cause = error; cause && !visited.has(cause); cause = cause.cause) {
    visited.add(cause);
    if (TEMPORARY_NETWORK_ERRORS.has(cause.code)) return cause.code;
  }
  return null;
}

function detroitCalendarDate(timestamp) {
  if (typeof timestamp !== 'string') return null;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    DETROIT_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function repositoryMatches(run, expectedFullName) {
  const headRepository = run?.head_repository?.full_name;
  if (typeof headRepository === 'string') {
    return headRepository.toLowerCase() === expectedFullName.toLowerCase();
  }

  // The workflow-runs endpoint is scoped to the target repository. Use its
  // repository field when GitHub omits head_repository for a branch run.
  const repository = run?.repository?.full_name;
  return typeof repository === 'string'
    && repository.toLowerCase() === expectedFullName.toLowerCase();
}

function requireValidTiming(timeoutMs, pollIntervalMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a finite non-negative number');
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new TypeError('pollIntervalMs must be a finite positive number');
  }
}

async function waitForDailyCI({
  github,
  context,
  core,
  now = () => performance.now(),
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) {
  requireValidTiming(timeoutMs, pollIntervalMs);

  if (!github?.rest?.actions?.getWorkflowRun || !github?.rest?.actions?.listWorkflowRuns) {
    throw new TypeError('github REST Actions methods are required');
  }
  if (typeof core?.info !== 'function') {
    throw new TypeError('core.info is required');
  }

  const { owner, repo } = context?.repo ?? {};
  const expectedFullName = `${owner}/${repo}`;
  const expectedSha = context?.sha;
  const deploymentRunId = context?.runId;

  if (!owner || !repo || !expectedSha || !deploymentRunId) {
    throw new TypeError('GitHub repository, SHA, and workflow run context are required');
  }
  if (context.eventName !== 'schedule' || context.ref !== 'refs/heads/main') {
    throw new Error('Daily CI wait is only valid for a scheduled run on main');
  }

  const startedAt = now();
  // Retry read-only transport failures within the same deadline as CI polling.
  // Every recovered response still has to pass the repository/SHA/date gates.
  async function readGitHub(label, request) {
    let retrying = false;
    const timedOut = (cause) => new Error(
      `Timed out after ${timeoutMs}ms reading GitHub ${label}; refusing deployment`,
      { cause },
    );
    while (true) {
      const elapsedMs = now() - startedAt;
      // A zero timeout still permits the original immediate lookup, but no retry.
      if (elapsedMs > timeoutMs || (retrying && elapsedMs >= timeoutMs)) throw timedOut();
      try {
        const response = await request();
        if (now() - startedAt > timeoutMs) throw timedOut();
        return response;
      } catch (error) {
        const reason = retryableReadFailure(error);
        if (!reason) throw error;

        const remainingMs = timeoutMs - (now() - startedAt);
        if (remainingMs <= 0) throw timedOut(error);
        core.info(`Temporary GitHub ${label} read failure (${reason}); retrying within the CI wait deadline.`);
        await sleep(Math.min(pollIntervalMs, remainingMs));
        retrying = true;
      }
    }
  }

  const deploymentResponse = await readGitHub('deployment run', () => github.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: deploymentRunId,
  }));
  const deploymentRun = deploymentResponse?.data;

  if (
    !deploymentRun
    || deploymentRun.event !== 'schedule'
    || deploymentRun.head_branch !== 'main'
    || deploymentRun.head_sha !== expectedSha
    || !repositoryMatches(deploymentRun, expectedFullName)
  ) {
    throw new Error('Could not verify this scheduled deploy run belongs to main in the current repository');
  }

  const scheduledDate = detroitCalendarDate(deploymentRun.created_at);
  if (!scheduledDate) {
    throw new Error('Scheduled deploy run has no valid created_at timestamp');
  }

  while (true) {
    const response = await readGitHub('scheduled CI runs', () => github.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: 'ci.yml',
      event: 'schedule',
      branch: 'main',
      per_page: 100,
    }));
    const workflowRuns = response?.data?.workflow_runs;
    if (!Array.isArray(workflowRuns)) {
      throw new Error('GitHub returned an invalid CI workflow-runs response');
    }

    const matchingRuns = workflowRuns.filter((run) => (
      run?.event === 'schedule'
      && run.head_branch === 'main'
      && run.head_sha === expectedSha
      && repositoryMatches(run, expectedFullName)
      && detroitCalendarDate(run.created_at) === scheduledDate
    ));

    const unsuccessfulRun = matchingRuns.find((run) => (
      run.status === 'completed' && run.conclusion !== 'success'
    ));
    if (unsuccessfulRun) {
      throw new Error(
        `Scheduled CI run ${unsuccessfulRun.id} completed with conclusion ${unsuccessfulRun.conclusion ?? 'unknown'}; refusing deployment`,
      );
    }

    const successfulRun = matchingRuns.find((run) => (
      run.status === 'completed' && run.conclusion === 'success'
    ));
    if (successfulRun) {
      core.info(`Verified scheduled CI run ${successfulRun.id} for ${scheduledDate}.`);
      return {
        runId: successfulRun.id,
        scheduledDate,
      };
    }

    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for scheduled CI on ${scheduledDate}; refusing deployment`,
      );
    }

    await sleep(Math.min(pollIntervalMs, remainingMs));
  }
}

module.exports = { waitForDailyCI };
