/**
 * GENERATED FILE — do not edit.
 *
 * Source: https://opentranscription.io/openapi.json
 * Regenerate: npm run typegen
 */

export interface paths {
    "/api/v1/transcriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List transcription jobs
         * @description List your organization's transcription jobs. **Required scope:** `transcriptions:read`.
         *
         *     Results are paginated. Use `page` and `limit` to navigate. Filter by `status` to monitor in-progress jobs, or by `search` to find a specific file.
         */
        get: operations["listTranscriptions"];
        put?: never;
        /**
         * Create a transcription job
         * @description Create a new transcription job. **Required scope:** `transcriptions:write`.
         *
         *     Before calling this endpoint, first call `POST /api/v1/uploads` to obtain a signed URL, upload your audio file directly to that URL, and pass the returned `file_path` to this endpoint.
         *
         *     The job is enqueued asynchronously — poll `GET /api/v1/transcriptions/{id}` or set a `webhook_url` to receive completion notification.
         *
         *     **Billing:** Credits are reserved upfront based on estimated file duration. Actual cost is committed when the job completes. If the job fails, reserved credits are released. Use `use_own_key: true` to route the job through your organization's provider API key (BYOK) — no credits are consumed.
         */
        post: operations["createTranscription"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/transcriptions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a transcription job
         * @description Fetch the current status and, if completed, the full transcript for a single job. **Required scope:** `transcriptions:read`.
         *
         *     When `status` is `completed`, the `transcript` field is populated. When the job is still processing, `transcript` is absent.
         */
        get: operations["getTranscription"];
        put?: never;
        post?: never;
        /**
         * Cancel or delete a transcription job
         * @description Cancel a pending or in-progress job, or delete a completed/failed job. **Required scope:** `transcriptions:write`.
         *
         *     For pending (`pending_upload`, `uploaded`) jobs the job is cancelled and its reservation is released back to your balance immediately.
         *
         *     For `processing` jobs the job is cancelled but the reservation is **not** returned immediately, because the transcription provider has already been billed for the work in flight. Credit reservations are reconciled later by an automated sweep once your organization has nothing running. Trial and free-tier allowances are **not** reconciled: cancelling a `processing` job consumes that run. Cancel before processing starts if you need the allowance back.
         *
         *     The response `message` tells you which happened.
         *
         *     For `completed` or `failed` jobs the job is marked deleted and stops appearing in `GET /api/v1/transcriptions`; a subsequent `GET /api/v1/transcriptions/{id}` returns 404. Its `status` is preserved, so a completed job is never relabelled as cancelled. The underlying record is retained because billing and usage history reference it.
         */
        delete: operations["deleteTranscription"];
        options?: never;
        head?: never;
        /**
         * Rename a transcription job
         * @description Update editable job fields. Currently only `title` is editable. **Required scope:** `transcriptions:write`. Send `title: null` to clear a previously-set title (display will fall back to `file_name`).
         */
        patch: operations["updateTranscription"];
        trace?: never;
    };
    "/api/v1/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create a signed upload URL for audio file upload
         * @description Generate a signed PUT URL for uploading an audio file directly to Supabase Storage. **Required scope:** `transcriptions:write`.
         *
         *     **Three-step upload flow:**
         *     1. Call `POST /api/v1/uploads` with the file metadata to get a signed `upload_url` and a `file_path`.
         *     2. Upload the raw audio bytes directly to `upload_url` using an HTTP `PUT` request with the file as the request body.
         *     3. Pass the returned `file_path` to `POST /api/v1/transcriptions` to create the transcription job.
         *
         *     The signed URL expires in approximately 1–2 hours. Check the exact `expires_at` field for the precise expiration time. If you do not complete the upload before `expires_at`, request a new URL.
         *
         *     **Audio only.** Uploads must be an audio file. To transcribe a video, extract its audio track first and upload that — e.g. `ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a libmp3lame output.mp3`. Accepted audio types: mp3, wav, m4a, flac, ogg/opus, webm.
         */
        post: operations["createUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get usage statistics
         * @description Usage stats for your organization aggregated by model and time period. **Required scope:** `usage:read`.
         *
         *     Returns job counts, audio minutes processed, and credits spent. Useful for billing reconciliation and capacity planning.
         *
         *     **Period granularity:** `7d` and `30d` group by calendar day (YYYY-MM-DD). `90d` and `365d` group by calendar month (YYYY-MM).
         */
        get: operations["getUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List transcription models
         * @description Returns all active transcription models with pricing and capabilities. No authentication required.
         *
         *     By default returns the `ModelsData` shape (models + filter options + stats). Pass any marketplace query parameter (`mode`, `compliance`, `capabilities`, `badge`, `min_price`, `max_price`) to receive the richer `MarketplaceData` shape that includes per-model health metrics, badges, and benchmark breakdowns.
         *
         *     Filter values are validated: an unrecognized `mode`, `compliance`, `capabilities`, or `badge` value, or a non-numeric `min_price`/`max_price`, returns `400` with a message naming the invalid value(s) and the allowed set. Comma-separated values tolerate surrounding whitespace.
         *
         *     Responses are cached at the CDN layer for up to 1 hour (`Cache-Control: public, s-maxage=3600`).
         */
        get: operations["listModels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/models/{modelId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a single model
         * @description Returns details for one model by its `provider/model-name` id (e.g. `deepgram/nova-3`). No authentication required.
         *
         *     Returns the same per-model entry found in the `models` array of GET /api/v1/models. Responds `404` if no active model matches the id.
         *
         *     Responses are cached at the CDN layer for up to 1 hour (`Cache-Control: public, s-maxage=3600`).
         */
        get: operations["getModel"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get leaderboard
         * @description Returns the accuracy and performance leaderboard across all models. No authentication required.
         *
         *     Models are scored and ranked by a composite metric (50% accuracy, 30% speed, 20% cost). Use `language`, `category`, and `accent` filters to see rankings for specific audio domains.
         *
         *     Set `mode=realtime` to get the realtime-STT leaderboard instead — streaming models scored on accuracy, responsiveness (time to first word), and stability (flicker), with the same `language`/`category`/`accent` filters. Defaults to `mode=batch`.
         *
         *     Responses are cached at the CDN layer for up to 1 hour.
         */
        get: operations["listBenchmarks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download leaderboard as CSV
         * @description Returns the same leaderboard as `GET /api/v1/benchmarks`, serialized as a downloadable CSV file (`Content-Disposition: attachment`). No authentication required.
         *
         *     Columns for `mode=batch` (default): `rank, model_id, model_name, provider_name, overall_score, avg_wer, avg_cer, avg_mer, avg_wil, avg_latency_ms, cost_credits_per_second, cost_usd_per_min, benchmark_count, last_run_at`. `cost_usd_per_min` is derived as `cost_credits_per_second × 0.6`.
         *
         *     Columns for `mode=realtime`: `rank, model_id, model_name, provider_name, realtime_score, avg_wer, avg_cer, p50_ttfw_ms, p50_drain_ms, avg_flicker, avg_cadence, avg_rtf, benchmark_count, last_run_at`.
         *
         *     The `rank` column is 1-based and matches the ranked board order. The `language`, `category`, and `accent` filters behave exactly as on the JSON endpoint. Responses are cached at the CDN layer for up to 1 hour.
         */
        get: operations["exportBenchmarks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks/{modelId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get model benchmark detail
         * @description Detailed benchmark history, category breakdown, and accent breakdown for a single model. No authentication required.
         *
         *     Returns `404` if the model has no **batch** benchmark data (model may exist but may not have been evaluated yet). The response's `realtime` field carries realtime-STT benchmark detail for that model and is `null` when the model has no realtime benchmark rows — it is independent of the 404 gate above, which is keyed on batch data only.
         */
        get: operations["getModelBenchmarks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export interface webhooks {
    transcriptionCompleted: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Transcription completed
         * @description Sent to your `webhook_url` when a job completes. Thin event — fetch the transcript with `GET /api/v1/transcriptions/{data.id}`. Verify the `X-OT-Signature` header: HMAC-SHA256 over `<t>.<raw_body>` with your signing secret (Settings → API keys), constant-time compare against any `v1`, reject if `|now - t| > 300s`. Dedupe on `id` (delivery is at-least-once). Return 2xx quickly; non-2xx is retried with exponential backoff up to 5 times.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    /**
                     * @example {
                     *       "id": "evt_9f8c2a1b4d6e",
                     *       "event": "transcription.completed",
                     *       "created": "2025-01-15T10:30:42.000Z",
                     *       "data": {
                     *         "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                     *         "status": "completed",
                     *         "error_code": null
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["WebhookEvent"];
                };
            };
            responses: {
                /** @description Your endpoint acknowledged receipt of the event. Return any 2xx status to confirm delivery — this is independent of the job outcome (a `transcription.failed` event is still ACKed with 2xx). A non-2xx response is retried up to 5 times with exponential backoff. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    transcriptionFailed: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Transcription failed
         * @description Sent to your `webhook_url` when a job fails. `data.status` is always `"failed"`. `data.error` and `data.error_code` are populated. Same `X-OT-Signature` verification as `transcriptionCompleted`.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    /**
                     * @example {
                     *       "id": "evt_3c7d9e2f1a5b",
                     *       "event": "transcription.failed",
                     *       "created": "2025-01-15T10:31:05.000Z",
                     *       "data": {
                     *         "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                     *         "status": "failed",
                     *         "error": "Provider returned a non-retryable error.",
                     *         "error_code": "transcription_failed"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["WebhookEvent"];
                };
            };
            responses: {
                /** @description Your endpoint acknowledged receipt of the event. Return any 2xx status to confirm delivery — this is independent of the job outcome (a `transcription.failed` event is still ACKed with 2xx). A non-2xx response is retried up to 5 times with exponential backoff. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export interface components {
    schemas: {
        /** @description Signed webhook event delivered to a job's `webhook_url`. Thin by design — contains identifiers, not the transcript. */
        WebhookEvent: {
            /**
             * @description Unique event/delivery ID (`evt_…`). Dedupe key — stable across retries of the same delivery.
             * @example evt_9f8c2a1b4d6e
             */
            id: string;
            /** @enum {string} */
            event: "transcription.completed" | "transcription.failed";
            /** Format: date-time */
            created: string;
            data: {
                /**
                 * Format: uuid
                 * @description Job ID. Use with GET /api/v1/transcriptions/{id}.
                 */
                id: string;
                /** @enum {string} */
                status: "completed" | "failed";
                /** @description Present on failure only. */
                error?: string | null;
                /** @description Structured error identifier on failure; null otherwise. */
                error_code?: string | null;
            };
        };
        /** @description Standard error response body. */
        ErrorResponse: {
            /** @description Human-readable error message. */
            error: string;
            /** @description Present on 403 scope errors — the required scope that was missing. */
            required?: string;
            /** @description Present on validation errors — the raw Zod issues, each naming the offending path and what was expected. */
            details?: Record<string, never>[];
            /**
             * Format: uri
             * @description Present on 400 responses — where this request's contract is defined. Deep-links to the request schema when the endpoint has one (e.g. `#/components/schemas/CreateTranscriptionRequest`), otherwise points at this document.
             */
            documentation_url?: string;
        };
        /**
         * @description Lifecycle state of a transcription job.
         * @enum {string}
         */
        JobStatus: "pending_upload" | "uploaded" | "processing" | "completed" | "failed" | "cancelled";
        /** @description A time-aligned segment of transcript text. */
        TranscriptionSegment: {
            /** @description Zero-based segment index. */
            id: number;
            /**
             * Format: float
             * @description Segment start time in seconds.
             */
            start: number;
            /**
             * Format: float
             * @description Segment end time in seconds.
             */
            end: number;
            /** @description Transcribed text for this segment. */
            text: string;
            /** @description Speaker label if diarization was enabled (e.g. `A`, `B`). Null otherwise. */
            speaker?: string | null;
        };
        /** @description Word-level timing and confidence. */
        TranscriptionWord: {
            /** @description The transcribed word. */
            word: string;
            /**
             * Format: float
             * @description Word start time in seconds.
             */
            start: number;
            /**
             * Format: float
             * @description Word end time in seconds.
             */
            end: number;
            /**
             * Format: float
             * @description Confidence score (0.0–1.0). Not always provided by all models.
             */
            confidence?: number;
            /** @description Speaker label if diarization was enabled. */
            speaker?: string;
        };
        /** @description Completed transcript in the OpenTranscription Unified Schema (OTUS). */
        Transcript: {
            /** @description Full transcript as a single string. */
            text: string;
            /** @description Detected or specified ISO 639-1 language code. */
            language?: string | null;
            /**
             * Format: float
             * @description Overall confidence score (0.0–1.0), if provided by the model.
             */
            confidence?: number | null;
            /** @description Time-aligned segments. Null if the model does not support segment-level output. */
            segments?: components["schemas"]["TranscriptionSegment"][] | null;
            /** @description Word-level timing. Null if the model does not support word timestamps. */
            words?: components["schemas"]["TranscriptionWord"][] | null;
        };
        /**
         * @description Request body for creating a transcription job.
         *
         *     **Model selection:** Provide exactly one of `model`, `models`, or `router`. Use `model` for a single direct model, `models` for a user-defined fallback chain (first is primary; subsequent entries are tried on retryable failure), or `router` for automatic strategy-based selection.
         *
         *     Virtual model IDs (`auto/cheapest`, `auto/fastest`, `auto/best`) are also accepted in the `model` field as shorthand for router strategies.
         */
        CreateTranscriptionRequest: {
            /**
             * @description Audio file path in Supabase Storage. Format: `<org_uuid>/<filename>`. Obtain by uploading via the dashboard or the storage upload flow first.
             * @example a1b2c3d4-e5f6-7890-abcd-ef1234567890/interview-2025-01-15.mp3
             */
            file_path: string;
            /**
             * @description Model ID to use. See `GET /api/v1/models` for available models. Mutually exclusive with `models` and `router`.
             *
             *     Virtual IDs are also accepted: `auto/cheapest` (lowest cost), `auto/fastest` (lowest latency), `auto/best` (lowest WER).
             * @example openai/whisper-large-v3
             */
            model?: string;
            /**
             * @description Ordered fallback chain of concrete model IDs (no `auto/*` virtual IDs). The first entry is the primary; on retryable provider failure, subsequent entries are tried in order. Mutually exclusive with `model` and `router`. Chains are subject to your organization's routing preferences — if an org `blocked_providers` rule or `max_cost_per_minute_credits` cap excludes an entry, the job fails with `preferences_conflict` or `cost_cap_exceeded`.
             * @example [
             *       "deepgram/nova-3",
             *       "assemblyai/best",
             *       "openai/whisper-large-v3"
             *     ]
             */
            models?: string[];
            router?: components["schemas"]["RouterConfig"];
            /**
             * @description ISO 639-1 language code (e.g. `en`, `es`). If omitted, the model will auto-detect. When using `router`, this also filters candidate models to those supporting the specified language.
             * @example en
             */
            language?: string;
            /** @description Enable speaker diarization. `true` forces on, `false` forces off, omit to use the model's default. When using `router`, models that don't support diarization are excluded from candidates. */
            diarization?: boolean;
            /**
             * @description Route this job through your organization's BYOK provider API key. Requires a key configured in settings. A 5% routing fee (of equivalent provider cost) is charged to platform credits; the first 100 minutes/month per org are free. A negative credit balance blocks new jobs.
             * @default false
             */
            use_own_key: boolean;
            /**
             * Format: uri
             * @description Public HTTPS URL to receive a POST notification when the job completes or fails. Events are signed (`X-OT-Signature`) and delivered at-least-once with retries — see the `webhooks` section. Thin payload; fetch the transcript via `GET /api/v1/transcriptions/{id}`.
             * @example https://your-app.example.com/webhooks/transcription
             */
            webhook_url?: string;
            /**
             * @description Arbitrary key-value metadata stored with the job. Values can be any JSON type.
             * @example {
             *       "customer_id": "cust_12345",
             *       "source": "mobile-app"
             *     }
             */
            metadata?: {
                [key: string]: unknown;
            };
            /**
             * Format: float
             * @description Client-detected audio duration in seconds. Used for credit reservation estimation only — more accurate than the server-side file-size heuristic.
             */
            duration?: number;
            /**
             * Format: uuid
             * @description UUID of a user-uploaded fine-tuned model. Mutually exclusive with standard `model` routing.
             */
            custom_model_id?: string;
            /**
             * Format: uuid
             * @description UUID of a saved vocabulary list to improve recognition of domain-specific terms.
             */
            vocabulary_list_id?: string;
            /**
             * @description Inline custom vocabulary words for this transcription. Each word is 1-100 characters. Max 1000 entries.
             * @example [
             *       "Kubernetes",
             *       "HIPAA",
             *       "NLP"
             *     ]
             */
            custom_words?: string[];
            /** @description Optional user-defined display name for this job. Shown in the UI list and detail page; falls back to `file_name` when null. Whitespace is trimmed; whitespace-only values are rejected. */
            title?: string | null;
            /** @description Enable code-switching detection for mixed-language audio (explicit opt-in only, not auto-enabled). When using `router`, models that don't support code-switching are excluded from candidates. */
            code_switching?: boolean;
            /**
             * Format: float
             * @description Confidence threshold for code-switching detection (0.0-1.0). AssemblyAI only.
             */
            code_switching_confidence_threshold?: number;
        };
        /** @description Partial update of an existing transcription job. All properties optional. */
        UpdateTranscriptionRequest: {
            /** @description Display name. Send `null` to clear. */
            title?: string | null;
        };
        /**
         * @description Smart Router configuration for automatic model selection. The router picks the optimal model based on the specified strategy, filtering candidates by language, features, and provider constraints.
         *
         *     On provider failure, the router automatically falls back to the next-best candidate (up to 2 fallbacks). The response includes `routed_from` indicating the strategy used and `model_id` showing which model actually processed the job.
         */
        RouterConfig: {
            /**
             * @description `cheapest` — lowest `cost_per_second`. `fastest` — lowest `p95_latency_ms` from live health data. `most_accurate` — lowest Word Error Rate from benchmark data (filterable by `preset`).
             * @enum {string}
             */
            strategy: "cheapest" | "fastest" | "most_accurate";
            /**
             * @description Audio domain preset for the `most_accurate` strategy. Selects which benchmark category to sort by. Defaults to `general`. Ignored for other strategies.
             * @default general
             * @enum {string}
             */
            preset: "general" | "medical" | "legal" | "technical" | "conversational" | "noisy";
            /**
             * @description Allowlist of model IDs or provider slugs. Only models matching an entry are considered. A provider slug (e.g. `deepgram`) matches all models from that provider. A full model ID (e.g. `deepgram/nova-3`) matches exactly.
             * @example [
             *       "deepgram",
             *       "assemblyai/best"
             *     ]
             */
            only?: string[];
            /**
             * @description Blocklist of model IDs or provider slugs. Models matching any entry are excluded from candidates.
             * @example [
             *       "openai"
             *     ]
             */
            ignore?: string[];
            /**
             * @description Whether to automatically try the next-best model on provider failure. Defaults to `true`. Set to `false` to fail immediately if the selected model errors.
             * @default true
             */
            allow_fallbacks: boolean;
        };
        /** @description Confirmation returned after a job is successfully created. */
        TranscriptionJobCreated: {
            /**
             * Format: uuid
             * @description Unique job identifier. Use this to poll status.
             */
            id: string;
            status: components["schemas"]["JobStatus"];
            /** @description The model ID that will process this job. When using the router, this is the resolved model — not the virtual `auto/*` ID. */
            model_id: string;
            /**
             * Format: uuid
             * @description Custom model UUID if one was specified.
             */
            custom_model_id?: string | null;
            /** @description Language code as specified in the request. */
            language?: string | null;
            /** @description Whether BYOK routing is active for this job. */
            use_own_key: boolean;
            /** @description Credits reserved for this job. `0` for BYOK or free-model jobs. */
            credits_reserved: number;
            /**
             * @description Routing strategy that selected this model (e.g. `auto/cheapest`). `null` when the user specified a model directly via `model` or a user-defined `models` chain — for chain-based routing see `fallback_source` instead.
             * @example auto/cheapest
             */
            routed_from?: string | null;
            /**
             * @description Origin of the routing decision for this job. `auto` — Smart Router selected the model (via `router` or a virtual `auto/*` ID). `user_chain` — resolved from a user-supplied `models` fallback chain (returns the chain's primary). `null` — direct-model selection with no router or chain. Actual fallback events that occur during execution are recorded on the job record (`GET /transcriptions/{id}`) under `router_context.fallbacks_used`.
             * @enum {string|null}
             */
            fallback_source?: "auto" | "user_chain" | null;
            /**
             * Format: date-time
             * @description ISO 8601 timestamp when the job was created.
             */
            created_at: string;
        };
        /** @description Abridged job record returned in list operations. */
        TranscriptionJobSummary: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["JobStatus"];
            /** @description Model ID used for this job. */
            model_id?: string | null;
            /** @description Human-readable model display name. */
            model_name?: string | null;
            /** @description Provider name (e.g. `OpenAI`, `Deepgram`). */
            provider?: string | null;
            /** @description Language code. */
            language?: string | null;
            /** @description User-defined display name. Null if not set — clients should fall back to `file_name` for display. */
            title?: string | null;
            /** @description Original file name. */
            file_name?: string;
            /** @description File size in bytes. */
            file_size_bytes?: number | null;
            /** @description Credits reserved at job creation. */
            credits_reserved?: number | null;
            /** @description Credits actually consumed. Null until job completes. */
            credits_used?: number | null;
            /** @description Wall-clock processing time in milliseconds. Null until job completes. */
            processing_time_ms?: number | null;
            /** @description User-safe error message if the job failed. Sanitized; never contains internal details. For programmatic handling, prefer the structured error_code field. */
            error?: string | null;
            /**
             * @description Structured machine-readable error identifier set when `status='failed'`. Null for successful jobs and legacy rows.
             *
             *     For programmatic handling, branch on this field rather than parsing the human-readable `error` text. New codes may be added over time — consumers should handle unknown values gracefully and fall back to displaying the `error` field.
             *
             *     **Known codes:**
             *
             *     | Code | Meaning | Recommended action |
             *     |------|---------|--------------------|
             *     | `service_unavailable` | Platform funding issue, transient | Retry after a few minutes |
             *     | `transcription_failed` | Provider returned a non-retryable error | Try a different model or audio file |
             *     | `model_not_found` | Selected model is unavailable or inactive | Choose another model |
             *     | `insufficient_credits` | Not enough credits for the operation | Top up the account |
             *     | `free_minutes_exhausted` | Free-tier minutes used up for the month | Upgrade or wait until next month |
             *     | `max_fallbacks_exceeded` | Router exhausted the fallback chain | Contact support |
             *     | `internal_error` | Infrastructure issue | Retry later; contact support if persistent |
             *     | `provider_access_blocked` | Provider blocked the request at the network level (VPN/proxy/IP reputation) | Disable any VPN/proxy or use a paid key |
             *     | `provider_auth_failed` | Provider rejected the credentials — invalid/expired key or insufficient permissions | Check the API key and its permissions |
             *     | `unsupported_audio` | The audio's format or length is not supported by the selected model | Try a different file or model |
             *     | `unsupported_language` | The requested language is not supported by the selected model | Select a supported language or model |
             *     | `provider_payment_required` | BYOK: your provider account is out of credit | Add funds or enable billing with the provider |
             */
            error_code?: string | null;
            /** @description Whether a completed transcript is available for this job. */
            has_transcript: boolean;
            /** Format: date-time */
            created_at?: string | null;
            /** Format: date-time */
            updated_at?: string | null;
        };
        /** @description Pagination metadata. */
        PaginationMeta: {
            /** @description Current page (1-indexed). */
            page: number;
            /** @description Results per page. */
            limit: number;
            /** @description Total number of matching records. */
            total: number;
            /** @description Total number of pages. */
            totalPages: number;
        };
        /** @description Paginated list of transcription job summaries. */
        TranscriptionJobList: {
            data: components["schemas"]["TranscriptionJobSummary"][];
            pagination: components["schemas"]["PaginationMeta"];
        };
        /** @description Full job record, including transcript if the job has completed. */
        TranscriptionJobDetail: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["JobStatus"];
            model_id?: string | null;
            language?: string | null;
            /** @description User-defined display name. Null if not set — clients should fall back to `file_name` for display. */
            title?: string | null;
            file_name?: string;
            file_size_bytes?: number | null;
            credits_reserved?: number | null;
            credits_used?: number | null;
            processing_time_ms?: number | null;
            /** @description User-safe error message if the job failed. Sanitized; never contains internal details. For programmatic handling, prefer the structured error_code field. */
            error?: string | null;
            /**
             * @description Structured machine-readable error identifier set when `status='failed'`. Null for successful jobs and legacy rows.
             *
             *     For programmatic handling, branch on this field rather than parsing the human-readable `error` text. New codes may be added over time — consumers should handle unknown values gracefully and fall back to displaying the `error` field.
             *
             *     **Known codes:**
             *
             *     | Code | Meaning | Recommended action |
             *     |------|---------|--------------------|
             *     | `service_unavailable` | Platform funding issue, transient | Retry after a few minutes |
             *     | `transcription_failed` | Provider returned a non-retryable error | Try a different model or audio file |
             *     | `model_not_found` | Selected model is unavailable or inactive | Choose another model |
             *     | `insufficient_credits` | Not enough credits for the operation | Top up the account |
             *     | `free_minutes_exhausted` | Free-tier minutes used up for the month | Upgrade or wait until next month |
             *     | `max_fallbacks_exceeded` | Router exhausted the fallback chain | Contact support |
             *     | `internal_error` | Infrastructure issue | Retry later; contact support if persistent |
             *     | `provider_access_blocked` | Provider blocked the request at the network level (VPN/proxy/IP reputation) | Disable any VPN/proxy or use a paid key |
             *     | `provider_auth_failed` | Provider rejected the credentials — invalid/expired key or insufficient permissions | Check the API key and its permissions |
             *     | `unsupported_audio` | The audio's format or length is not supported by the selected model | Try a different file or model |
             *     | `unsupported_language` | The requested language is not supported by the selected model | Select a supported language or model |
             *     | `provider_payment_required` | BYOK: your provider account is out of credit | Add funds or enable billing with the provider |
             */
            error_code?: string | null;
            /** Format: uri */
            webhook_url?: string | null;
            /** @description Metadata as set during job creation. */
            metadata?: {
                [key: string]: unknown;
            } | null;
            /** Format: date-time */
            created_at?: string | null;
            /** Format: date-time */
            updated_at?: string | null;
            /** @description Present only when `status` is `completed`. */
            transcript?: components["schemas"]["Transcript"];
        };
        /** @description Response after cancelling or deleting a job. */
        TranscriptionDeleteResponse: {
            /** @description Describes what happened (cancelled vs. deleted). */
            message: string;
            /** Format: uuid */
            id: string;
            /** @description Present when a pending/processing job was cancelled. Value is always `cancelled`. */
            status?: string;
        };
        /** @description Usage breakdown for a single model. */
        UsageByModel: {
            /** @description Model ID. */
            model_id: string;
            /** @description Human-readable model name. */
            model_name: string;
            /** @description Provider name. */
            provider_name: string;
            /** @description Number of jobs run with this model in the period. */
            job_count: number;
            /**
             * Format: float
             * @description Total audio minutes processed.
             */
            total_minutes: number;
            /** @description Total credits consumed by this model. */
            total_credits: number;
        };
        /** @description Usage for a single time bucket. */
        UsageByPeriod: {
            /**
             * @description Date bucket. `YYYY-MM-DD` for 7d/30d periods; `YYYY-MM` for 90d/365d periods.
             * @example 2025-01-15
             */
            date: string;
            job_count: number;
            /** Format: float */
            total_minutes: number;
            total_credits: number;
        };
        /** @description Aggregated usage statistics. */
        UsageResponse: {
            /** @description Total jobs in the period. */
            total_jobs: number;
            /**
             * Format: float
             * @description Total audio minutes processed (rounded to 2 decimal places).
             */
            total_minutes: number;
            /** @description Total platform credits consumed (sum of job charges and platform fees). */
            total_credits_spent: number;
            /**
             * @description The period this report covers.
             * @enum {string}
             */
            period: "7d" | "30d" | "90d" | "365d";
            /** @description Usage broken down by model, sorted by `job_count` descending. */
            by_model: components["schemas"]["UsageByModel"][];
            /** @description Usage broken down by time bucket, sorted by date ascending. */
            by_period: components["schemas"]["UsageByPeriod"][];
        };
        ModelProvider: {
            /** @description Provider UUID. */
            id: string;
            /** @description Provider display name (e.g. `OpenAI`, `Deepgram`). */
            name: string;
        };
        ModelPricing: {
            /**
             * Format: float
             * @description Cost in credits per second of audio. Multiply by 60 to get credits per minute.
             */
            cost_per_second: number;
            /**
             * @description Always `credits`. 1 credit = $0.01 USD.
             * @enum {string}
             */
            currency: "credits";
        };
        ModelPerformance: {
            /**
             * Format: float
             * @description Ratio of audio duration to processing time (e.g. `12.5x` means 1 min of audio processes in ~5s).
             */
            avg_speed_factor?: number | null;
            /**
             * Format: float
             * @description Average Word Error Rate across benchmark runs (0.0 = perfect). Only present if benchmarks exist.
             */
            avg_wer?: number;
            /**
             * Format: float
             * @description Average Character Error Rate. Optional.
             */
            avg_cer?: number;
            /**
             * Format: float
             * @description Average Match Error Rate. Optional.
             */
            avg_mer?: number;
            /**
             * Format: float
             * @description Average Word Information Lost. Optional.
             */
            avg_wil?: number;
            /** @description Average processing latency in milliseconds. Optional. */
            avg_latency_ms?: number;
        };
        ModelCapabilities: {
            /** @description ISO 639-1 language codes supported by this model. */
            supported_languages: string[];
            /** @description Maximum accepted file size in bytes. Null if unlimited. Enforced at job creation against the stored object's byte count. */
            max_file_size?: number | null;
            /**
             * @description Maximum accepted audio duration in seconds. Null when the provider documents no duration limit. Enforced at job creation against the `duration` you declare on the request; omit `duration` and the check is skipped, but the job may then fail at the provider instead.
             * @example 900
             * @example 36000
             * @example null
             */
            max_duration_seconds?: number | null;
            /** @description Accepted audio format extensions (e.g. `mp3`, `wav`, `flac`). */
            supported_formats: string[];
            /** @description Enabled feature list (e.g. `diarization`, `word_timestamps`, `smart_format`). */
            features: string[];
        };
        /** @description A transcription model with pricing and capabilities. */
        ModelEntry: {
            /** @description Unique model identifier in `provider/model-name` format. */
            id: string;
            /** @description Internal model name slug. */
            name: string;
            /** @description Human-readable display name. */
            display_name: string;
            provider: components["schemas"]["ModelProvider"];
            /** @description Localized description of the model. */
            description: string;
            pricing: components["schemas"]["ModelPricing"];
            performance: components["schemas"]["ModelPerformance"];
            capabilities: components["schemas"]["ModelCapabilities"];
            /** @description Whether the model is currently available. */
            is_active: boolean;
            /**
             * @description `batch` = file upload only; `realtime` = streaming only; `both` = supports either.
             * @enum {string}
             */
            mode: "batch" | "realtime" | "both";
        };
        ModelFilters: {
            /** @description Distinct language codes across all active models. */
            languages: string[];
            /** @description Distinct providers with active models. */
            providers: components["schemas"]["ModelProvider"][];
            priceRange: {
                /** Format: float */
                min: number;
                /** Format: float */
                max: number;
            };
        };
        ModelStats: {
            total_models: number;
            total_languages: number;
            /**
             * Format: float
             * @description Average `cost_per_second` across all active models.
             */
            avg_price: number;
        };
        /** @description Standard models catalog payload (no marketplace params). */
        ModelsData: {
            models: components["schemas"]["ModelEntry"][];
            filters: components["schemas"]["ModelFilters"];
            stats: components["schemas"]["ModelStats"];
        };
        /** @description Top-level wrapper for the models catalog. */
        ModelsResponse: {
            data: components["schemas"]["ModelsData"];
        };
        /** @description A single model's leaderboard position and aggregate benchmark metrics. */
        LeaderboardEntry: {
            model_id: string;
            model_name: string;
            provider_name: string;
            description: string;
            /**
             * Format: float
             * @description Average Word Error Rate (0.0 = perfect).
             */
            avg_wer: number;
            /**
             * Format: float
             * @description Average Character Error Rate. Optional.
             */
            avg_cer?: number;
            /**
             * Format: float
             * @description Average Match Error Rate. Optional.
             */
            avg_mer?: number;
            /**
             * Format: float
             * @description Average Word Information Lost. Optional.
             */
            avg_wil?: number;
            /** @description Average processing latency in milliseconds. */
            avg_latency_ms: number;
            /**
             * Format: float
             * @description Credits per second of audio.
             */
            avg_cost_per_second: number;
            /** @description Number of benchmark runs included in the averages. */
            benchmark_count: number;
            /**
             * Format: float
             * @description Composite score 0–100. Weights: 50% accuracy, 30% speed, 20% cost.
             */
            overall_score: number;
            /**
             * Format: date-time
             * @description Timestamp of the most recent benchmark run for this model.
             */
            last_run_at: string;
        };
        LeaderboardFilters: {
            languages: string[];
            categories: string[];
            accents: string[];
        };
        LeaderboardData: {
            leaderboard: components["schemas"]["LeaderboardEntry"][];
            filters: components["schemas"]["LeaderboardFilters"];
            /** @description Total number of benchmark rows in the result set (before grouping). */
            total_benchmarks: number;
            /** @description Number of models represented in the leaderboard. */
            total_models: number;
        };
        LeaderboardResponse: {
            data: components["schemas"]["LeaderboardData"];
        };
        BenchmarkModel: {
            id: string;
            /** @description Display name. */
            name: string;
            description: string;
            provider_name: string;
            /** Format: float */
            cost_per_second: number;
        };
        BenchmarkSummary: {
            /** Format: float */
            avg_wer: number;
            /** Format: float */
            avg_cer?: number;
            /** Format: float */
            avg_mer?: number;
            /** Format: float */
            avg_wil?: number;
            avg_latency_ms: number;
            benchmark_count: number;
            /**
             * Format: float
             * @description Composite score 0–100.
             */
            overall_score: number;
        };
        BenchmarkHistoryEntry: {
            /**
             * @description Date of the benchmark run (YYYY-MM-DD).
             * @example 2025-01-14
             */
            run_at: string;
            /** Format: float */
            avg_wer: number;
            /** Format: float */
            avg_cer?: number;
            /** Format: float */
            avg_mer?: number;
            /** Format: float */
            avg_wil?: number;
            avg_latency_ms: number;
            benchmark_count: number;
        };
        BenchmarkCategoryEntry: {
            category: string;
            /** Format: float */
            avg_wer: number;
            /** Format: float */
            avg_cer?: number;
            /** Format: float */
            avg_mer?: number;
            /** Format: float */
            avg_wil?: number;
            avg_latency_ms: number;
            count: number;
        };
        BenchmarkAccentEntry: {
            accent: string;
            /** Format: float */
            avg_wer: number;
            count: number;
        };
        /** @description Detailed benchmark data for a single model. */
        ModelBenchmarkDetail: {
            model?: components["schemas"]["BenchmarkModel"];
            summary?: components["schemas"]["BenchmarkSummary"];
            /** @description Per-date aggregate benchmark results, sorted ascending by date. */
            history?: components["schemas"]["BenchmarkHistoryEntry"][];
            /** @description Benchmark breakdown by golden set category. */
            by_category?: components["schemas"]["BenchmarkCategoryEntry"][];
            /** @description Benchmark breakdown by accent. */
            by_accent?: components["schemas"]["BenchmarkAccentEntry"][];
            /** @description Realtime-STT benchmark detail for this model, or null if it has no realtime benchmark rows. */
            realtime: components["schemas"]["RealtimeBenchmarkDetail"] | null;
        };
        ModelBenchmarkDetailResponse: {
            data: components["schemas"]["ModelBenchmarkDetail"];
        };
        /** @description A single model's realtime-STT leaderboard position and aggregate streaming metrics. */
        RealtimeLeaderboardEntry: {
            model_id: string;
            model_name: string;
            provider_name: string;
            /** @description P50 time to first output in milliseconds — the first word shown, whether an interim partial or a committed final (so commit-as-you-go models that emit no partials still report a value). Field named `ttfp` for historical reasons. */
            p50_ttfw_ms: number | null;
            /** @description P50 final-chunk drain time in milliseconds, after audio stops. */
            p50_drain_ms: number | null;
            /**
             * Format: float
             * @description Average partial-word revision rate (0.0 = no revisions).
             */
            avg_flicker: number;
            /**
             * Format: float
             * @description Average partial emissions per second of audio. Descriptive, not scored.
             */
            avg_cadence: number;
            /**
             * Format: float
             * @description Average real-time factor. Reads ≈1.0 for a well-behaved model, since audio is streamed at 1× pace. Descriptive, not scored.
             */
            avg_rtf: number;
            /**
             * Format: float
             * @description Average Word Error Rate (0.0 = perfect).
             */
            avg_wer: number;
            /**
             * Format: float
             * @description Average Character Error Rate. Optional.
             */
            avg_cer?: number;
            /** @description Number of realtime benchmark runs included in the averages. */
            benchmark_count: number;
            /**
             * Format: float
             * @description Composite realtime score 0–100. Weights: 50% accuracy, 25% responsiveness (time to first word), 20% stability (flicker), 5% tail latency (drain).
             */
            realtime_score: number;
            /**
             * Format: date-time
             * @description Timestamp of the most recent realtime benchmark run for this model.
             */
            last_run_at: string;
        };
        RealtimeLeaderboardFilters: {
            languages: string[];
            categories: string[];
            accents: string[];
        };
        RealtimeLeaderboardData: {
            leaderboard: components["schemas"]["RealtimeLeaderboardEntry"][];
            filters: components["schemas"]["RealtimeLeaderboardFilters"];
            /** @description Total number of realtime benchmark rows in the result set (before grouping). */
            total_benchmarks: number;
            /** @description Number of models represented in the realtime leaderboard. */
            total_models: number;
            /**
             * Format: date-time
             * @description Timestamp of the most recent realtime benchmark run across all models.
             */
            last_run_at: string | null;
        };
        RealtimeLeaderboardResponse: {
            data: components["schemas"]["RealtimeLeaderboardData"];
        };
        RealtimeBenchmarkCategoryEntry: {
            category: string;
            p50_ttfw_ms: number | null;
            /** Format: float */
            avg_wer: number;
            /** Format: float */
            avg_flicker: number;
        };
        RealtimeBenchmarkSummary: {
            p50_ttfw_ms: number | null;
            p50_drain_ms: number | null;
            /** Format: float */
            avg_flicker: number;
            /** Format: float */
            avg_cadence: number;
            /** Format: float */
            avg_rtf: number;
            /** Format: float */
            avg_wer: number;
            /** Format: float */
            avg_cer?: number;
            benchmark_count: number;
            /** Format: float */
            realtime_score: number;
        };
        /** @description Detailed realtime-STT benchmark data for a single model: an overall roll-up plus a per-category breakdown. */
        RealtimeBenchmarkDetail: {
            model_id: string;
            summary: components["schemas"]["RealtimeBenchmarkSummary"];
            /** @description Realtime benchmark breakdown by golden set category. */
            by_category: components["schemas"]["RealtimeBenchmarkCategoryEntry"][];
            /** Format: date-time */
            last_run_at: string | null;
        };
    };
    responses: {
        /**
         * @description The request body or query parameters failed validation, or the request body was not valid JSON.
         *
         *     A request whose body is empty or malformed JSON returns `{ "error": "Invalid JSON" }`. A well-formed body that fails schema validation returns `{ "error": "Validation error", "details": [...] }`, where `details` carries the raw Zod issues.
         *
         *     Every 400 also carries a `documentation_url` pointing at the schema that defines the request, so a failing call tells you where its contract is written down.
         *
         *     **Routing-preferences error codes** (when posting to `/api/v1/transcriptions` with `model`, `models`, or `router`):
         *     - `preferences_conflict` — every entry in the `models` chain is excluded by your org's `blocked_providers` allowlist/blocklist.
         *     - `cost_cap_exceeded` — every candidate exceeds the org's `max_cost_per_minute_credits` cap (BYOK and custom-model jobs bypass the cap).
         *     - `invalid_model_in_chain` — one or more `models[]` entries are not valid, active model IDs.
         *     - `org_config_invalid` — the org's stored routing preferences failed schema validation on read; request is failed closed. Contact support or an org admin to reset preferences.
         *     - `model_capacity_exceeded` — the audio exceeds the chosen model's documented capacity. The response carries `limit` (`max_file_size` or `max_duration_seconds`), `model_id`, `limit_value` in the same units `/v1/models` publishes for that field (BYTES for size, seconds for duration), and an English `detail`. Size is checked against the stored object; duration only against the `duration` you declared, so omitting `duration` skips that check and defers the failure to the provider. `auto/*` routes around an over-capacity model instead of failing.
         */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Missing or invalid API key. */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Unauthorized"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Valid API key, but the key lacks the required scope. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Insufficient scope",
                 *       "required": "transcriptions:write"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description The requested resource was not found. */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Job not found"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Insufficient credits or free-minutes allowance exhausted — or the organization has a negative credit balance (outstanding BYOK fees). */
        PaymentRequired: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Insufficient credits. Please add credits to your account."
                 *     }
                 */
                "application/json": components["schemas"]["ErrorResponse"] & {
                    /** @description Machine-readable error code. `FREE_MINUTES_EXHAUSTED` when the monthly free allowance is used up. `NEGATIVE_BALANCE` when the organization has an outstanding BYOK fee overdraft. */
                    code?: string;
                    /** @description ISO 8601 date when free minutes reset. Present when `code` is `FREE_MINUTES_EXHAUSTED`. */
                    reset_at?: string;
                };
            };
        };
        /** @description Too many requests — rate limit exceeded. */
        RateLimited: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Too many requests"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Unexpected server error. */
        InternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Internal server error"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
    };
    parameters: {
        /** @description UUID of the transcription job. */
        PathJobId: string;
        /** @description Model ID in `provider/model-name` format (e.g. `openai/whisper-large-v3`). */
        PathModelId: string;
        /** @description Maximum number of results to return. Default: 25, max: 100. */
        QueryLimit: number;
        /** @description 1-indexed page number. */
        QueryPage: number;
    };
    requestBodies: never;
    headers: {
        /** @description Requests allowed per minute for your tier. */
        "X-RateLimit-Limit": number;
        /** @description Requests remaining in the current window. */
        "X-RateLimit-Remaining": number;
        /** @description Unix timestamp (seconds) when the rate limit window resets. */
        "X-RateLimit-Reset": number;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listTranscriptions: {
        parameters: {
            query?: {
                /** @description Maximum number of results to return. Default: 25, max: 100. */
                limit?: components["parameters"]["QueryLimit"];
                /** @description 1-indexed page number. */
                page?: components["parameters"]["QueryPage"];
                /** @description Filter by job status. Accepts a single status value or comma-separated list (e.g. `processing,uploaded`). */
                status?: string;
                /** @description Case-insensitive substring search across `file_name` and `title`. Matches when either field contains the query. Filter metacharacters `, ( ) * " \` are rejected with 400. */
                search?: string;
                /** @description Sort direction by `created_at`. Defaults to `desc` (newest first). */
                sort?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated list of jobs. */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                    "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                    "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "data": [
                     *         {
                     *           "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                     *           "status": "completed",
                     *           "model_id": "openai/whisper-large-v3",
                     *           "model_name": "Whisper Large v3",
                     *           "provider": "OpenAI",
                     *           "language": "en",
                     *           "title": null,
                     *           "file_name": "audio-2025-01-15.mp3",
                     *           "file_size_bytes": 4200000,
                     *           "credits_reserved": 150,
                     *           "credits_used": 142,
                     *           "processing_time_ms": 8400,
                     *           "error": null,
                     *           "has_transcript": true,
                     *           "created_at": "2025-01-15T10:30:00.000Z",
                     *           "updated_at": "2025-01-15T10:30:42.000Z"
                     *         }
                     *       ],
                     *       "pagination": {
                     *         "page": 1,
                     *         "limit": 25,
                     *         "total": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TranscriptionJobList"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createTranscription: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTranscriptionRequest"];
            };
        };
        responses: {
            /** @description Job created and enqueued for processing. */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                    "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                    "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionJobCreated"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            402: components["responses"]["PaymentRequired"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description No models match the routing constraints. Returned when using `router` and all candidate models are filtered out by language, feature, or provider constraints. The `suggestions` array lists near-miss models with the specific constraint that excluded them. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "no_models_match",
                     *       "message": "No active models match your routing constraints.",
                     *       "suggestions": [
                     *         {
                     *           "model_id": "deepgram/nova-3",
                     *           "failed_constraint": "features",
                     *           "detail": "Missing features: diarization"
                     *         },
                     *         {
                     *           "model_id": "openai/whisper-large-v3",
                     *           "failed_constraint": "language",
                     *           "detail": "Model does not support language: ja"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": {
                        /** @enum {string} */
                        error: "no_models_match";
                        message: string;
                        suggestions: {
                            model_id: string;
                            failed_constraint: string;
                            detail: string;
                        }[];
                    };
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getTranscription: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID of the transcription job. */
                id: components["parameters"]["PathJobId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Job details, with transcript if available. */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                    "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                    "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                     *       "status": "completed",
                     *       "model_id": "openai/whisper-large-v3",
                     *       "language": "en",
                     *       "title": null,
                     *       "file_name": "audio-2025-01-15.mp3",
                     *       "file_size_bytes": 4200000,
                     *       "credits_reserved": 150,
                     *       "credits_used": 142,
                     *       "processing_time_ms": 8400,
                     *       "error": null,
                     *       "webhook_url": null,
                     *       "metadata": {
                     *         "estimated_duration_seconds": 210
                     *       },
                     *       "created_at": "2025-01-15T10:30:00.000Z",
                     *       "updated_at": "2025-01-15T10:30:42.000Z",
                     *       "transcript": {
                     *         "text": "Hello, this is a sample transcription of the audio file.",
                     *         "language": "en",
                     *         "confidence": 0.97,
                     *         "segments": [
                     *           {
                     *             "id": 0,
                     *             "start": 0,
                     *             "end": 3.5,
                     *             "text": "Hello, this is a sample transcription of the audio file.",
                     *             "speaker": null
                     *           }
                     *         ],
                     *         "words": [
                     *           {
                     *             "word": "Hello",
                     *             "start": 0,
                     *             "end": 0.5,
                     *             "confidence": 0.99
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TranscriptionJobDetail"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteTranscription: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID of the transcription job. */
                id: components["parameters"]["PathJobId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Job cancelled or deleted. */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                    "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                    "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionDeleteResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateTranscription: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID of the transcription job. */
                id: components["parameters"]["PathJobId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "title": "Bob interview - intake call"
                 *     }
                 */
                "application/json": components["schemas"]["UpdateTranscriptionRequest"];
            };
        };
        responses: {
            /** @description Job updated. Returns the full job summary shape so clients can sync their cache without a follow-up GET. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionJobSummary"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createUpload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "file_name": "interview-2025-01-15.mp3",
                 *       "file_size": 3456789,
                 *       "mime_type": "audio/mpeg"
                 *     }
                 */
                "application/json": {
                    /** @description Original filename including extension (e.g. `interview.mp3`). Used to derive the storage path extension and validate the file format. */
                    file_name: string;
                    /** @description File size in bytes. Must not exceed 100 MiB (104,857,600 bytes). */
                    file_size: number;
                    /** @description MIME type of the audio file (e.g. `audio/mpeg`, `audio/wav`, `audio/ogg`). Used to validate the file format alongside the filename extension. */
                    mime_type: string;
                };
            };
        };
        responses: {
            /** @description Signed upload URL generated. PUT your audio bytes to `upload_url` before `expires_at`. */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                    "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                    "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "upload_url": "https://storage.supabase.co/storage/v1/object/upload/sign/audio/a1b2c3d4-e5f6-7890-abcd-ef1234567890/1736944200000_xK9mNpQrStUvWxYz.mp3?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                     *       "file_path": "a1b2c3d4-e5f6-7890-abcd-ef1234567890/1736944200000_xK9mNpQrStUvWxYz.mp3",
                     *       "expires_at": "2025-01-15T12:10:00.000Z"
                     *     }
                     */
                    "application/json": {
                        /**
                         * Format: uri
                         * @description Short-lived signed PUT URL. Upload the raw audio file bytes to this URL using `PUT` with the file as the request body.
                         */
                        upload_url: string;
                        /** @description Storage path for the uploaded file (format: `<org_uuid>/<timestamp>_<id>.<ext>`). Pass this value as `file_path` when calling `POST /api/v1/transcriptions`. */
                        file_path: string;
                        /**
                         * Format: date-time
                         * @description ISO 8601 timestamp when the `upload_url` expires, extracted from the JWT embedded in the URL itself. Typically 1–2 hours from issuance. You must complete the upload before this time.
                         */
                        expires_at: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getUsage: {
        parameters: {
            query?: {
                /** @description Lookback window for the report. */
                period?: "7d" | "30d" | "90d" | "365d";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Usage statistics for the requested period. */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                    "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                    "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "total_jobs": 48,
                     *       "total_minutes": 312.75,
                     *       "total_credits_spent": 4420,
                     *       "period": "30d",
                     *       "by_model": [
                     *         {
                     *           "model_id": "openai/whisper-large-v3",
                     *           "model_name": "Whisper Large v3",
                     *           "provider_name": "OpenAI",
                     *           "job_count": 32,
                     *           "total_minutes": 218.5,
                     *           "total_credits": 3094
                     *         },
                     *         {
                     *           "model_id": "deepgram/nova-2",
                     *           "model_name": "Nova-2",
                     *           "provider_name": "Deepgram",
                     *           "job_count": 16,
                     *           "total_minutes": 94.25,
                     *           "total_credits": 1326
                     *         }
                     *       ],
                     *       "by_period": [
                     *         {
                     *           "date": "2025-01-15",
                     *           "job_count": 5,
                     *           "total_minutes": 34.2,
                     *           "total_credits": 484
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["UsageResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listModels: {
        parameters: {
            query?: {
                /** @description Filter by transcription mode. `both` includes models that support either. */
                mode?: "batch" | "realtime" | "both";
                /** @description Comma-separated compliance certifications to filter by (e.g. `hipaa,soc2`). All listed certifications must be met. */
                compliance?: string;
                /** @description Comma-separated model capabilities to filter by (e.g. `diarization,custom_vocabulary`). A model must advertise **all** listed capabilities to match (AND semantics). Recognized keys: `diarization`, `custom_vocabulary`, `word_timestamps`, `code_switching`, `auto_detect`. */
                capabilities?: string;
                /** @description Comma-separated badge types to filter by. Any matching badge qualifies the model. */
                badge?: string;
                /** @description Minimum `cost_per_second` (inclusive). */
                min_price?: number;
                /** @description Maximum `cost_per_second` (inclusive). */
                max_price?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Model catalog. Shape varies by query parameters — see description. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "data": {
                     *         "models": [
                     *           {
                     *             "id": "openai/whisper-large-v3",
                     *             "name": "whisper-large-v3",
                     *             "display_name": "Whisper Large v3",
                     *             "provider": {
                     *               "id": "prov-openai-uuid",
                     *               "name": "OpenAI"
                     *             },
                     *             "description": "OpenAI's most capable open-source speech-to-text model. Excellent accuracy across languages.",
                     *             "pricing": {
                     *               "cost_per_second": 0.0111,
                     *               "currency": "credits"
                     *             },
                     *             "performance": {
                     *               "avg_speed_factor": 12.5,
                     *               "avg_wer": 0.0412,
                     *               "avg_latency_ms": 680
                     *             },
                     *             "capabilities": {
                     *               "supported_languages": [
                     *                 "en",
                     *                 "es",
                     *                 "fr",
                     *                 "de",
                     *                 "ja",
                     *                 "zh"
                     *               ],
                     *               "max_file_size": 26214400,
                     *               "max_duration_seconds": null,
                     *               "supported_formats": [
                     *                 "mp3",
                     *                 "mp4",
                     *                 "wav",
                     *                 "flac",
                     *                 "ogg",
                     *                 "m4a"
                     *               ],
                     *               "features": [
                     *                 "diarization",
                     *                 "word_timestamps"
                     *               ]
                     *             },
                     *             "is_active": true,
                     *             "mode": "batch"
                     *           },
                     *           {
                     *             "id": "deepgram/nova-2",
                     *             "name": "nova-2",
                     *             "display_name": "Nova-2",
                     *             "provider": {
                     *               "id": "prov-deepgram-uuid",
                     *               "name": "Deepgram"
                     *             },
                     *             "description": "Deepgram's fastest production model with strong English accuracy.",
                     *             "pricing": {
                     *               "cost_per_second": 0.0083,
                     *               "currency": "credits"
                     *             },
                     *             "performance": {
                     *               "avg_speed_factor": 45,
                     *               "avg_wer": 0.0621,
                     *               "avg_latency_ms": 320
                     *             },
                     *             "capabilities": {
                     *               "supported_languages": [
                     *                 "en"
                     *               ],
                     *               "max_file_size": 2147483648,
                     *               "max_duration_seconds": null,
                     *               "supported_formats": [
                     *                 "mp3",
                     *                 "wav",
                     *                 "flac",
                     *                 "ogg",
                     *                 "m4a",
                     *                 "webm"
                     *               ],
                     *               "features": [
                     *                 "diarization",
                     *                 "word_timestamps",
                     *                 "smart_format"
                     *               ]
                     *             },
                     *             "is_active": true,
                     *             "mode": "both"
                     *           }
                     *         ],
                     *         "filters": {
                     *           "languages": [
                     *             "de",
                     *             "en",
                     *             "es",
                     *             "fr",
                     *             "ja",
                     *             "zh"
                     *           ],
                     *           "providers": [
                     *             {
                     *               "id": "prov-deepgram-uuid",
                     *               "name": "Deepgram"
                     *             },
                     *             {
                     *               "id": "prov-openai-uuid",
                     *               "name": "OpenAI"
                     *             }
                     *           ],
                     *           "priceRange": {
                     *             "min": 0,
                     *             "max": 0.0278
                     *           }
                     *         },
                     *         "stats": {
                     *           "total_models": 2,
                     *           "total_languages": 6,
                     *           "avg_price": 0.0097
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ModelsResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            500: components["responses"]["InternalError"];
        };
    };
    getModel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Model ID in `provider/model-name` format (e.g. `openai/whisper-large-v3`). */
                modelId: components["parameters"]["PathModelId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The requested model. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ModelEntry"];
                    };
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    listBenchmarks: {
        parameters: {
            query?: {
                /** @description Which leaderboard to return. Defaults to `batch`. */
                mode?: "batch" | "realtime";
                /** @description ISO 639-1 language code to filter benchmark results (e.g. `en`, `es`). */
                language?: string;
                /** @description Audio category filter (e.g. `medical`, `legal`, `conversational`). */
                category?: string;
                /** @description Accent filter. Accepted values: `us`, `uk`, `indian`, `australian`, `african`. */
                accent?: "us" | "uk" | "indian" | "australian" | "african";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Leaderboard data. Shape depends on `mode`: `LeaderboardResponse` for `mode=batch` (default), `RealtimeLeaderboardResponse` for `mode=realtime`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeaderboardResponse"] | components["schemas"]["RealtimeLeaderboardResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            500: components["responses"]["InternalError"];
        };
    };
    exportBenchmarks: {
        parameters: {
            query?: {
                /** @description Which leaderboard to export. Defaults to `batch`. */
                mode?: "batch" | "realtime";
                /** @description ISO 639-1 language code to filter benchmark results (e.g. `en`, `es`). */
                language?: string;
                /** @description Audio category filter (e.g. `medical`, `legal`, `conversational`). */
                category?: string;
                /** @description Accent filter. Accepted values: `us`, `uk`, `indian`, `australian`, `african`. */
                accent?: "us" | "uk" | "indian" | "australian" | "african";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CSV file of the leaderboard, ranked order preserved. The `Content-Disposition` header names the file (e.g. `opentranscription-batch-benchmarks-2026-07-23.csv`). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example rank,model_id,model_name,provider_name,overall_score,avg_wer,avg_cer,avg_mer,avg_wil,avg_latency_ms,cost_credits_per_second,cost_usd_per_min,benchmark_count,last_run_at
                     *     1,cartesia/ink-whisper,Ink-Whisper,Cartesia,84.6,0.172,0.09,0.15,0.2,773,0.003667,0.0022,35,2026-07-23T03:00:00.000Z
                     */
                    "text/csv": string;
                };
            };
            400: components["responses"]["BadRequest"];
            500: components["responses"]["InternalError"];
        };
    };
    getModelBenchmarks: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Model ID in `provider/model-name` format (e.g. `openai/whisper-large-v3`). */
                modelId: components["parameters"]["PathModelId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Model benchmark detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "data": {
                     *         "model": {
                     *           "id": "openai/whisper-large-v3",
                     *           "name": "Whisper Large v3",
                     *           "description": "OpenAI's most capable open-source speech-to-text model.",
                     *           "provider_name": "OpenAI",
                     *           "cost_per_second": 0.0111
                     *         },
                     *         "summary": {
                     *           "avg_wer": 0.0412,
                     *           "avg_cer": 0.0198,
                     *           "avg_latency_ms": 680,
                     *           "benchmark_count": 24,
                     *           "overall_score": 87.4
                     *         },
                     *         "history": [
                     *           {
                     *             "run_at": "2025-01-07",
                     *             "avg_wer": 0.0421,
                     *             "avg_latency_ms": 695,
                     *             "benchmark_count": 8
                     *           },
                     *           {
                     *             "run_at": "2025-01-14",
                     *             "avg_wer": 0.0412,
                     *             "avg_latency_ms": 680,
                     *             "benchmark_count": 8
                     *           }
                     *         ],
                     *         "by_category": [
                     *           {
                     *             "category": "conversational",
                     *             "avg_wer": 0.0388,
                     *             "avg_latency_ms": 660,
                     *             "count": 8
                     *           },
                     *           {
                     *             "category": "medical",
                     *             "avg_wer": 0.0521,
                     *             "avg_latency_ms": 710,
                     *             "count": 8
                     *           }
                     *         ],
                     *         "by_accent": [
                     *           {
                     *             "accent": "us",
                     *             "avg_wer": 0.0355,
                     *             "count": 12
                     *           },
                     *           {
                     *             "accent": "uk",
                     *             "avg_wer": 0.0489,
                     *             "count": 6
                     *           }
                     *         ],
                     *         "realtime": null
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ModelBenchmarkDetailResponse"];
                };
            };
            404: components["responses"]["NotFound"];
            500: components["responses"]["InternalError"];
        };
    };
}
