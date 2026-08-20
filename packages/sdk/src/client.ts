/**
 * Typed client for the OpenTranscription v1 API.
 *
 * Two things are hand-written rather than generated, because they are exactly
 * what codegen does badly and what every caller needs: the three-step upload,
 * and the polling loop.
 */

import type { components } from './generated/api.js';

// The API is served from the apex, not an `api.` subdomain — this is the
// `servers` entry in the published OpenAPI document.
const DEFAULT_BASE_URL = 'https://opentranscription.io';
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/** Statuses the API will never move away from. */
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  webm: 'audio/webm',
};

export type OpenTranscriptionOptions = {
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests and for runtimes with a non-global fetch. */
  fetch?: typeof fetch;
  /** Injectable so backoff is testable without real waiting. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Request fields this client deliberately does not surface.
 *
 * `file_path` is the server's name for the uploaded object — `transcribe`
 * supplies it from the upload response and a caller may not invent one.
 * `duration` is client-declared and can only ever RAISE the credit hold, and an
 * SDK caller holds bytes rather than a decoded duration, so offering it invites
 * a wrong guess for no gain. `router` is a nested strategy-and-constraints
 * object; `model: 'auto/best'` covers the common case and the full router is its
 * own design.
 */
type DeclinedField = 'file_path' | 'duration' | 'router';

type ApiRequest = components['schemas']['CreateTranscriptionRequest'];

/**
 * SDK option name -> API field name.
 *
 * The API is snake_case and this surface is not, and that is the entire
 * translation. Keeping it as data rather than a chain of ternaries in the
 * request body means adding a parameter is one line, and means the rule for
 * what counts as "not given" is written once instead of re-decided per field.
 */
const REQUEST_FIELDS = {
  model: 'model',
  models: 'models',
  language: 'language',
  diarization: 'diarization',
  customWords: 'custom_words',
  vocabularyListId: 'vocabulary_list_id',
  codeSwitching: 'code_switching',
  codeSwitchingConfidenceThreshold: 'code_switching_confidence_threshold',
  webhookUrl: 'webhook_url',
  metadata: 'metadata',
  title: 'title',
  useOwnKey: 'use_own_key',
  audioRetentionDays: 'audio_retention_days',
  customModelId: 'custom_model_id',
} as const satisfies Record<
  keyof Omit<TranscribeInput, 'file' | 'fileName'>,
  keyof ApiRequest
>;

/**
 * Fails to compile when the API grows a request field this client neither maps
 * nor has explicitly declined.
 *
 * Without it the generated types were imported by nothing: `custom_words` and
 * `vocabulary_list_id` sat in `generated/api.ts`, correct, for as long as the
 * hand-written options type went without them. The error names the missing
 * field.
 */
type Unhandled = Exclude<
  keyof ApiRequest,
  (typeof REQUEST_FIELDS)[keyof typeof REQUEST_FIELDS] | DeclinedField
>;
/**
 * A constraint, not a conditional: `T extends never` is checked where the alias
 * is declared. A bare `[T] extends [never] ? ... : ...` alias compiles happily
 * whatever T is, because nothing forces it to be evaluated — a guard that
 * cannot fail is worse than none, since it reads like coverage.
 */
type AssertNever<T extends never> = T;
export type NoUnhandledRequestFields = AssertNever<Unhandled>;

export type TranscribeInput = {
  file: Uint8Array | Blob;
  fileName: string;

  /**
   * One model id, or a virtual one the router resolves: `auto/best`,
   * `auto/cheapest`, `auto/fastest`. Exactly one of `model` or `models`.
   */
  model?: string;

  /**
   * Primary plus backups, tried in order when one fails. Two to five entries.
   * Exactly one of `model` or `models`.
   */
  models?: string[];

  /** ISO 639-1, two letters. Omit to let the model detect it. */
  language?: string;

  /**
   * Label speakers. `true` forces it on, `false` forces it off on a model that
   * would otherwise enable it, omitted follows the model's own default.
   */
  diarization?: boolean;

  /**
   * Terms to bias the model toward: product names, jargon, people. This is what
   * fixes a transcript that is right about the sentence and wrong about the one
   * word that mattered. Up to 1000 entries, 100 characters each.
   *
   * Only models whose `capabilities.features` include `custom_vocabulary` use
   * it; the rest ignore it rather than failing.
   */
  customWords?: string[];

  /**
   * A vocabulary list saved in the web app, by id. Merged with `customWords`
   * when both are given. The id comes from Settings -> Vocabulary; there is no
   * API-key-authenticated route that lists them.
   */
  vocabularyListId?: string;

  /** Handle audio that switches language mid-sentence. */
  codeSwitching?: boolean;

  /** 0 to 1. AssemblyAI only; ignored elsewhere. */
  codeSwitchingConfidenceThreshold?: number;

  /**
   * Public HTTPS URL to receive a signed `transcription.completed` event, so a
   * long job does not need `waitForJob` holding a process open.
   */
  webhookUrl?: string;

  /** Returned untouched on the job. Yours to correlate with. */
  metadata?: Record<string, unknown>;

  /** Display name in the web app. Falls back to the file name. */
  title?: string;

  /** Bill this job to your own provider key instead of platform credits. */
  useOwnKey?: boolean;

  /**
   * Override the organization's audio retention for this job: a whole number of
   * days, `0` to delete on completion, or `null` to keep it indefinitely.
   * Omitted leaves the organization default in force — which is why `null`
   * here is a real value and not the same as leaving it out.
   */
  audioRetentionDays?: number | null;

  /** A fine-tuned model you uploaded, by id. */
  customModelId?: string;
};

export type Job = {
  id: string;
  status: string;
  error?: string;
  /** Machine-readable failure cause. Absent on APIs older than 2026-08-18. */
  error_code?: string;
  [key: string]: unknown;
};

/** One entry of `GET /api/v1/models`, as the API actually shapes it. */
export type CatalogModel = {
  id: string;
  name?: string;
  display_name?: string;
  description?: string;
  mode?: string;
  is_active?: boolean;
  provider?: { id: string; name: string };
  pricing?: { cost_per_second: number; currency: string };
  performance?: { avg_wer?: number | null; avg_speed_factor?: number | null };
  capabilities?: {
    supported_languages?: string[];
    supported_formats?: string[];
    features?: string[];
    max_file_size?: number | null;
  };
  [key: string]: unknown;
};

export type WaitOptions = {
  pollIntervalMs?: number;
  signal?: AbortSignal;
};

/** A non-2xx response from the API, carrying whatever it told us. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * The job ran and failed. Distinct from `ApiError`: the request succeeded, so
 * retrying it is pointless — `code` is what tells a caller whether to re-encode
 * the audio, pick another model, or give up.
 */
export class JobFailedError extends Error {
  readonly code: string | undefined;
  readonly job: Job;

  constructor(job: Job) {
    super(job.error ?? 'Transcription failed');
    this.name = 'JobFailedError';
    this.code = job.error_code;
    this.job = job;
  }
}

const contentTypeFor = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
};

const byteLength = (file: Uint8Array | Blob): number =>
  'byteLength' in file ? file.byteLength : file.size;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** How many times a 429 is waited out before the caller hears about it. */
const RATE_LIMIT_RETRIES = 4;

/**
 * `Retry-After` is seconds; `X-RateLimit-Reset` is an epoch second. Fall back to
 * the poll interval when neither is usable rather than hammering immediately.
 *
 * Today the API sends only the second of those: `checkRateLimit` sets
 * `X-RateLimit-{Limit,Remaining,Reset}` and no `Retry-After`. The first branch
 * is kept because it is the standard header and costs nothing, but it is not
 * the one that fires.
 */
const retryAfterMs = (response: Response): number => {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;

  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) {
    const delta = reset * 1000 - Date.now();
    if (delta > 0) return Math.min(delta, 60_000);
  }

  return DEFAULT_POLL_INTERVAL_MS;
};

export class OpenTranscription {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(options: OpenTranscriptionOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#sleep = options.sleep ?? sleep;
  }

  /**
   * One authenticated request, with backoff on 429.
   *
   * A single `transcribe` can trip the free tier's 10/minute on its own —
   * upload, create, then a poll every couple of seconds — so surfacing a rate
   * limit to the caller would be blaming them for this client's pacing. The
   * server says when to come back; we wait that long, a bounded number of times,
   * and only give up if it keeps saying no.
   */
  async #api<T>(path: string, init?: RequestInit): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.#fetch(`${this.#baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          'content-type': 'application/json',
          ...init?.headers,
        },
      });

      const body = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (response.ok) return body as T;

      if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        await this.#sleep(retryAfterMs(response));
        continue;
      }

      throw new ApiError(
        typeof body.error === 'string' ? body.error : response.statusText,
        response.status,
        typeof body.code === 'string' ? body.code : undefined
      );
    }
  }

  /** Upload the audio and open a transcription job for it. */
  async transcribe(input: TranscribeInput): Promise<Job> {
    const { upload_url, file_path } = await this.#api<{
      upload_url: string;
      file_path: string;
    }>('/api/v1/uploads', {
      method: 'POST',
      // Field names are the API's, not ours: file_size and mime_type are both
      // required, and the route answers a bare "Validation error" when either is
      // missing or misspelled — so this is pinned by a test.
      body: JSON.stringify({
        file_name: input.fileName,
        file_size: byteLength(input.file),
        mime_type: contentTypeFor(input.fileName),
      }),
    });

    // Deliberately NOT through #api: the URL is already signed, so attaching the
    // API key would send a live credential to a host that never needs it.
    const upload = await this.#fetch(upload_url, {
      method: 'PUT',
      // Uint8Array and Blob are both valid fetch bodies; Node's types do not
      // expose a single union that covers them here.
      body: input.file as unknown as Uint8Array,
      headers: { 'content-type': contentTypeFor(input.fileName) },
    });

    if (!upload.ok) {
      throw new ApiError('Upload failed', upload.status);
    }

    // Only `undefined` means "not given". `false` and `null` are values the API
    // reads: `diarization: false` forces diarization off, and
    // `audio_retention_days: null` means retain indefinitely — treating either
    // as absent would quietly apply the opposite policy.
    const request: Record<string, unknown> = { file_path };
    for (const [option, field] of Object.entries(REQUEST_FIELDS)) {
      const value = input[option as keyof typeof REQUEST_FIELDS];
      if (value !== undefined) request[field] = value;
    }

    // `file_path` comes back from the API and is passed through untouched. It is
    // the server's name for the object, not something a client may construct.
    return this.#api<Job>('/api/v1/transcriptions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * The public model catalogue: ids, pricing, languages, measured accuracy.
   *
   * The payload is `{ data: { models, filters, stats } }` — the models are one
   * level deeper than the other list routes put theirs.
   */
  async listModels(): Promise<CatalogModel[]> {
    const body = await this.#api<{ data?: { models?: CatalogModel[] } }>(
      '/api/v1/models'
    );
    return body.data?.models ?? [];
  }

  /** Recent jobs, newest first. */
  async listJobs(limit = 10): Promise<Job[]> {
    const body = await this.#api<{ data?: Job[] }>(
      `/api/v1/transcriptions?limit=${encodeURIComponent(String(limit))}`
    );
    return body.data ?? [];
  }

  async getJob(id: string): Promise<Job> {
    return this.#api<Job>(`/api/v1/transcriptions/${encodeURIComponent(id)}`);
  }

  /** Poll until the job finishes. Throws `JobFailedError` if it failed. */
  async waitForJob(id: string, options: WaitOptions = {}): Promise<Job> {
    const interval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    for (;;) {
      if (options.signal?.aborted) throw new Error('Aborted');

      const job = await this.getJob(id);

      if (TERMINAL.has(job.status)) {
        if (job.status === 'failed') throw new JobFailedError(job);
        return job;
      }

      if (options.signal?.aborted) throw new Error('Aborted');

      await this.#sleep(interval);
    }
  }
}
