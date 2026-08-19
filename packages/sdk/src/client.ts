/**
 * Typed client for the OpenTranscription v1 API.
 *
 * Two things are hand-written rather than generated, because they are exactly
 * what codegen does badly and what every caller needs: the three-step upload,
 * and the polling loop.
 */

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
};

export type TranscribeInput = {
  file: Uint8Array | Blob;
  fileName: string;
  model?: string;
  language?: string;
  diarization?: boolean;
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class OpenTranscription {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: OpenTranscriptionOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async #api<T>(path: string, init?: RequestInit): Promise<T> {
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

    if (!response.ok) {
      throw new ApiError(
        typeof body.error === 'string' ? body.error : response.statusText,
        response.status,
        typeof body.code === 'string' ? body.code : undefined
      );
    }

    return body as T;
  }

  /** Upload the audio and open a transcription job for it. */
  async transcribe(input: TranscribeInput): Promise<Job> {
    const { upload_url, file_path } = await this.#api<{
      upload_url: string;
      file_path: string;
    }>('/api/v1/uploads', {
      method: 'POST',
      body: JSON.stringify({
        file_name: input.fileName,
        content_type: contentTypeFor(input.fileName),
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

    // `file_path` comes back from the API and is passed through untouched. It is
    // the server's name for the object, not something a client may construct.
    return this.#api<Job>('/api/v1/transcriptions', {
      method: 'POST',
      body: JSON.stringify({
        file_path,
        ...(input.model ? { model: input.model } : {}),
        ...(input.language ? { language: input.language } : {}),
        ...(input.diarization === undefined
          ? {}
          : { diarization: input.diarization }),
      }),
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

      await sleep(interval);
    }
  }
}
