import {
  type CatalogModel,
  type Job,
  OpenTranscription,
} from '@opentranscription/sdk';

import {
  defaultConfigDir,
  loadCredentials,
  resolveCredential,
} from '../credentials.js';
import { apiBaseUrl } from '../env.js';

type Io = {
  orgId?: string | undefined;
  configDir?: string;
  log?: (line: string) => void;
  client?: Pick<OpenTranscription, 'listModels' | 'listJobs'>;
  /** Injected so the credential path itself can be exercised in tests. */
  fetch?: typeof fetch;
};

const build = (apiKey: string, options: Io) =>
  new OpenTranscription({
    apiKey,
    baseUrl: apiBaseUrl(),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

/**
 * A client for the PUBLIC catalogue. `/v1/models` is an exempt route, so
 * requiring a login to read it would add friction the API does not impose — and
 * would block the case that matters most: an agent checking what is available
 * before anyone has signed in. A stored key is used when there is one, since it
 * costs nothing and keeps the request attributable.
 */
const catalogClient = async (options: Io) => {
  if (options.client) return options.client;

  const store = await loadCredentials(options.configDir ?? defaultConfigDir());
  try {
    return build(
      resolveCredential(store, { orgId: options.orgId }).apiKey,
      options
    );
  } catch {
    return build('', options);
  }
};

/** A client for routes that genuinely need a key; throws when there is none. */
const authedClient = async (options: Io) => {
  if (options.client) return options.client;

  const store = await loadCredentials(options.configDir ?? defaultConfigDir());
  const credential = resolveCredential(store, { orgId: options.orgId });

  return build(credential.apiKey, options);
};

const perMinute = (model: CatalogModel): string => {
  const perSecond = model.pricing?.cost_per_second;
  return perSecond === undefined
    ? '—'
    : `${(perSecond * 60).toFixed(2)} cr/min`;
};

/** Measured on the golden set. Absent for models that have not been swept. */
const accuracy = (model: CatalogModel): string => {
  const wer = model.performance?.avg_wer;
  return wer === null || wer === undefined
    ? ''
    : `  ${(100 - wer * 100).toFixed(1)}% acc`;
};

/**
 * `ot models` — what the agent is allowed to pass to `--model`.
 *
 * The skill tells the agent never to invent a model id, which only works if
 * there is a cheap way to see the real list.
 */
export const models = async (
  options: Io & { language?: string | undefined } = {}
): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const client = await catalogClient(options);

  let catalog: CatalogModel[] = await client.listModels();

  if (options.language) {
    const wanted = options.language.toLowerCase();
    catalog = catalog.filter((model) =>
      (model.capabilities?.supported_languages ?? []).some(
        (code) => code.toLowerCase() === wanted
      )
    );
  }

  if (catalog.length === 0) {
    log(
      options.language
        ? `No models support language "${options.language}".`
        : 'No models available.'
    );
    return 1;
  }

  log('auto/best        pick the most accurate model that fits');
  log('auto/cheapest    pick the cheapest model that fits');
  log('auto/fastest     pick the fastest model that fits');
  log('');

  for (const model of catalog) {
    const name = model.display_name ?? model.name ?? model.id;
    log(
      `${model.id.padEnd(34)} ${perMinute(model).padStart(13)}${accuracy(model).padEnd(14)}  ${name}`
    );
  }

  return 0;
};

/** `ot jobs` — recent transcriptions, so the agent can find one it lost. */
export const jobs = async (
  options: Io & { limit?: number } = {}
): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const client = await authedClient(options);

  const recent: Job[] = await client.listJobs(options.limit ?? 10);

  if (recent.length === 0) {
    log('No transcriptions yet.');
    return 0;
  }

  for (const job of recent) {
    const name = typeof job.file_name === 'string' ? job.file_name : '';
    const failure = job.error_code ? `  (${job.error_code})` : '';
    log(`${job.id}  ${job.status.padEnd(10)} ${name}${failure}`);
  }

  return 0;
};
