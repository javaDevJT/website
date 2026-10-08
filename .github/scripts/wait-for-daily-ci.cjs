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
const MAX_REQUEST_ATTEMPTS = 3;
const RETRYABLE_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);
const RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

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

function errorStatus(error) {
  const status = error?.status ?? error?.response?.status;
  return Number.isInteger(status) ? status : null;
}

function errorCode(error) {
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current.code === 'string') return current.code;
    current = current.cause;
  }

  // Octokit may preserve a native network error only in the wrapped message.
  const message = String(error?.message ?? '');
  return [...RETRYABLE_NETWORK_CODES].find((candidate) => (
    new RegExp(`\\b${candidate}\\b`).test(message)
  )) ?? null;
}

function responseHeader(error, name) {
  const headers = error?.response?.headers ?? error?.headers;
  if (!headers) return undefined;
  return headers[name.toLowerCase()] ?? headers.get?.(name.toLowerCase());
}

function isTransientRequestError(error) {
  const status = errorStatus(error);
  if (
    RETRYABLE_HTTP_STATUSES.has(status)
    || (status !== null && status >= 500)
  ) {
    return true;
  }

  if (
    status === 403
    && (responseHeader(error, 'retry-after') !== undefined
      || responseHeader(error, 'x-ratelimit-remaining') === '0')
  ) {
    return true;
  }

  const code = errorCode(error);
  if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;

  return false;
}

function retryDelayMs(error, attempt) {
  const retryAfter = responseHeader(error, 'retry-after');
  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter);
    const requestedDelay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(requestedDelay)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, requestedDelay));
    }
  }

  const resetAt = responseHeader(error, 'x-ratelimit-reset');
  if (resetAt !== undefined && responseHeader(error, 'x-ratelimit-remaining') === '0') {
    const requestedDelay = Number(resetAt) * 1000 - Date.now();
    if (Number.isFinite(requestedDelay)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, requestedDelay));
    }
  }

  return Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)));
}

async function requestWithRetry(method, request, { sleep, core }) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= MAX_REQUEST_ATTEMPTS || !isTransientRequestError(error)) {
        throw error;
      }

      const delayMs = retryDelayMs(error, attempt);
      const reason = errorStatus(error) ?? errorCode(error) ?? 'transient network error';
      core.info(
        `GitHub Actions ${method} failed transiently (${reason}); retrying attempt ${attempt + 1}/${MAX_REQUEST_ATTEMPTS} in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }
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
  const deploymentEvent = context.eventName;
  if (
    !['schedule', 'workflow_dispatch'].includes(deploymentEvent)
    || context.ref !== 'refs/heads/main'
  ) {
    throw new Error('CI wait is only valid for a scheduled or manually dispatched run on main');
  }

  const startedAt = now();
  const deploymentResponse = await requestWithRetry(
    'getWorkflowRun',
    () => github.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: deploymentRunId,
    }),
    { sleep, core },
  );
  const deploymentRun = deploymentResponse?.data;

  if (
    !deploymentRun
    || deploymentRun.event !== deploymentEvent
    || deploymentRun.head_branch !== 'main'
    || deploymentRun.head_sha !== expectedSha
    || !repositoryMatches(deploymentRun, expectedFullName)
  ) {
    throw new Error(`Could not verify this ${deploymentEvent} deploy run belongs to main in the current repository`);
  }

  const scheduledDate = detroitCalendarDate(deploymentRun.created_at);
  if (!scheduledDate) {
    throw new Error('Deploy run has no valid created_at timestamp');
  }
  const ciRunKind = deploymentEvent === 'schedule' ? 'scheduled' : 'manually dispatched';

  while (true) {
    const response = await requestWithRetry(
      'listWorkflowRuns',
      () => github.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: 'ci.yml',
        event: deploymentEvent,
        branch: 'main',
        per_page: 100,
      }),
      { sleep, core },
    );
    const workflowRuns = response?.data?.workflow_runs;
    if (!Array.isArray(workflowRuns)) {
      throw new Error('GitHub returned an invalid CI workflow-runs response');
    }

    const matchingRuns = workflowRuns.filter((run) => (
      run?.event === deploymentEvent
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
      core.info(`Verified ${ciRunKind} CI run ${successfulRun.id} for ${scheduledDate}.`);
      return {
        runId: successfulRun.id,
        scheduledDate,
      };
    }

    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${ciRunKind} CI on ${scheduledDate}; refusing deployment`,
      );
    }

    await sleep(Math.min(pollIntervalMs, remainingMs));
  }
}

module.exports = { waitForDailyCI };
