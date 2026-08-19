import {
  OpenTranscription,
  type CatalogModel,
  type Job,
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
};

const clientFor = async (options: Io) => {
  if (options.client) return options.client;

  const store = await loadCredentials(options.configDir ?? defaultConfigDir());
  const credential = resolveCredential(store, { orgId: options.orgId });

  return new OpenTranscription({
    apiKey: credential.apiKey,
    baseUrl: apiBaseUrl(),
  });
};

const perMinute = (costPerSecond: number | undefined): string =>
  costPerSecond === undefined ? '—' : `$${(costPerSecond * 60).toFixed(4)}/min`;

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
  const client = await clientFor(options);

  let catalog: CatalogModel[] = await client.listModels();

  if (options.language) {
    const wanted = options.language.toLowerCase();
    catalog = catalog.filter((model) =>
      (model.languages ?? []).some((code) => code.toLowerCase() === wanted)
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
  log('');

  for (const model of catalog) {
    const name = model.display_name ?? model.id;
    log(
      `${model.id.padEnd(38)} ${perMinute(model.cost_per_second).padStart(12)}  ${name}`
    );
  }

  return 0;
};

/** `ot jobs` — recent transcriptions, so the agent can find one it lost. */
export const jobs = async (
  options: Io & { limit?: number } = {}
): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const client = await clientFor(options);

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
