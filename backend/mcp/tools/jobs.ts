/**
 * Job-pattern generation tools: start_video_job, start_music_job, check_job.
 *
 * Veo video and Lyria-Pro audio take minutes — far beyond Cloudflare's ~100s
 * proxied-response window — so starting returns a jobId immediately and
 * check_job polls the Vertex operation (mirroring the app's client-side
 * getOperation loop, but persisted in mcp_jobs so pm2 restarts don't orphan
 * a render).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runGeneration } from '../../services/generation.ts';
import { projects } from '../../services/database.ts';
import { uploadBase64 } from '../../services/storage.ts';
import { VIDEO_MODELS, AUDIO_MODELS, findModel } from '../../../src/lib/models.ts';
import { jobStore } from '../jobs.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { imageBytesFromUrl } from '../media.ts';
import { projectContextFor } from '../projectContext.ts';
import { jsonResult, errorResult } from './util.ts';

const MAX_RUNNING_JOBS_PER_USER = 3;
const MAX_VIDEO_REFERENCES = 3;

function elapsedSeconds(createdAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(`${createdAt.replace(' ', 'T')}Z`).getTime()) / 1000));
}

export function registerJobTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'start_video_job',
    {
      title: 'Start a video generation job',
      description:
        `Generate video with Veo (${VIDEO_MODELS.map((m) => m.id).join(', ')}). Returns a jobId immediately — ` +
        'poll with check_job every ~15s (videos typically take 1–4 minutes). Supports aspect ratio, resolution, ' +
        'duration, negative prompt, seed, audio, a start/end frame image, and reference images (urls from the ' +
        'Library or external). The project\'s brand context is injected into the prompt automatically — pass ' +
        'includeProjectContext:false to opt out.',
      inputSchema: {
        projectId: z.string().min(1).describe("Target project id, or 'playground'"),
        prompt: z.string().min(1),
        model: z.string().optional().describe("Video model id (default 'veo-3.1-fast-generate-001')"),
        aspectRatio: z.string().optional().describe("'16:9' (default) or '9:16'"),
        resolution: z.string().optional().describe("'720p' (default), '1080p', or '4K' on veo-3.1"),
        duration: z.number().int().optional().describe('Seconds: 4, 6, or 8'),
        negativePrompt: z.string().optional(),
        seed: z.number().int().optional(),
        audio: z.boolean().optional().describe('Generate synced audio (costs more)'),
        startFrameUrl: z.string().optional().describe('Image the video starts from'),
        endFrameUrl: z.string().optional().describe('Image the video ends on'),
        referenceImages: z.array(z.object({ url: z.string() })).max(MAX_VIDEO_REFERENCES).optional(),
        includeProjectContext: z.boolean().optional().describe('Default true (no-op for playground)'),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'start_video_job', args, async () => {
        if (!projects.findById(args.projectId)) return errorResult(`Project not found: ${args.projectId}`);
        const modelId = args.model ?? 'veo-3.1-fast-generate-001';
        const model = findModel(modelId);
        if (!model || model.mode !== 'video') {
          return errorResult(`Unknown video model: ${modelId}. Valid: ${VIDEO_MODELS.map((m) => m.id).join(', ')}`);
        }
        if (jobStore.countRunning(ctx.user.id) >= MAX_RUNNING_JOBS_PER_USER) {
          return errorResult(`You already have ${MAX_RUNNING_JOBS_PER_USER} jobs running — check_job them first.`);
        }

        // Mirror src/services/gemini/videoService.ts exactly
        const config: any = {
          numberOfVideos: 1,
          sampleCount: 1,
          aspectRatio: args.aspectRatio ?? '16:9',
          resolution: args.resolution ?? '720p',
          duration: args.duration,
          ...(args.negativePrompt && { negativePrompt: args.negativePrompt }),
          ...(args.seed !== undefined && { seed: args.seed }),
          ...(args.audio !== undefined && { audio: args.audio }),
        };

        let image: { imageBytes: string; mimeType: string } | undefined;
        if (args.startFrameUrl) image = await imageBytesFromUrl(args.startFrameUrl);
        if (args.endFrameUrl) config.lastFrame = await imageBytesFromUrl(args.endFrameUrl);
        if (args.referenceImages?.length) {
          config.referenceImages = await Promise.all(
            args.referenceImages.map(async (ref) => ({
              image: await imageBytesFromUrl(ref.url).then(({ imageBytes, mimeType }) => ({ imageBytes, mimeType })),
              referenceType: 'ASSET',
            }))
          );
        }

        // Same prompt framing as the app (videoService)
        const context = args.includeProjectContext !== false ? projectContextFor(args.projectId) : '';
        const fullPrompt = context
          ? `Project Context: ${context}\n\nTask: Generate a video based on this prompt: ${args.prompt}`
          : args.prompt;

        const operation = await runGeneration({
          method: 'generateVideos',
          params: { model: modelId, prompt: fullPrompt, image, config, projectId: args.projectId },
          userId: ctx.user.id,
          via: 'mcp',
        });

        const jobId = jobStore.createJob({
          userId: ctx.user.id,
          projectId: args.projectId,
          kind: 'video',
          operationName: operation?.name ?? String(operation),
          model: modelId,
          // config is needed at poll time for cost calculation; keep only
          // JSON-safe context (no image bytes)
          params: {
            operationName: operation?.name,
            config: { ...config, lastFrame: undefined, referenceImages: undefined },
          },
        });

        return jsonResult(
          { jobId, status: 'running', pollEverySeconds: 15, expect: 'video jobs usually finish in 1–4 minutes' },
          'Video job started'
        );
      })
  );

  server.registerTool(
    'start_music_job',
    {
      title: 'Start a long-form music job',
      description:
        'Generate a full music track with Lyria Pro (30–120s durations, takes a few minutes). Returns a jobId — ' +
        'poll with check_job every ~15s. For a quick ~30s clip use generate_music_clip instead.',
      inputSchema: {
        projectId: z.string().min(1).describe("Target project id, or 'playground'"),
        prompt: z.string().min(1),
        duration: z.number().int().optional().describe('Seconds: 30, 60, 90, or 120'),
        negativePrompt: z.string().optional(),
        seed: z.number().int().optional(),
        bpm: z.number().int().min(40).max(220).optional(),
        density: z.number().min(0).max(1).optional(),
        brightness: z.number().min(0).max(1).optional(),
        musicScale: z.string().optional(),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'start_music_job', args, async () => {
        if (!projects.findById(args.projectId)) return errorResult(`Project not found: ${args.projectId}`);
        if (jobStore.countRunning(ctx.user.id) >= MAX_RUNNING_JOBS_PER_USER) {
          return errorResult(`You already have ${MAX_RUNNING_JOBS_PER_USER} jobs running — check_job them first.`);
        }
        const model = AUDIO_MODELS.find((m) => m.id.includes('pro'))?.id ?? 'lyria-3-pro-preview';

        const data = await runGeneration({
          method: 'generateContent',
          params: {
            model,
            contents: [{ parts: [{ text: args.prompt }] }],
            config: {
              responseModalities: ['AUDIO'],
              ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
              ...(args.duration && { duration: args.duration }),
              ...(args.seed !== undefined && { seed: args.seed }),
              ...(args.bpm !== undefined && { bpm: args.bpm }),
              ...(args.density !== undefined && { density: args.density }),
              ...(args.brightness !== undefined && { brightness: args.brightness }),
              ...(args.musicScale && { scale: args.musicScale }),
            },
            projectId: args.projectId,
          },
          userId: ctx.user.id,
          via: 'mcp',
        });

        if (!data?.isLro || !data.operation) {
          return errorResult('Lyria Pro did not return a long-running operation — try generate_music_clip.');
        }

        const jobId = jobStore.createJob({
          userId: ctx.user.id,
          projectId: args.projectId,
          kind: 'audio',
          operationName: data.operation,
          model,
          params: { operationName: data.operation },
        });

        return jsonResult(
          { jobId, status: 'running', pollEverySeconds: 15, expect: 'music jobs usually finish in 1–3 minutes' },
          'Music job started'
        );
      })
  );

  server.registerTool(
    'check_job',
    {
      title: 'Check a generation job',
      description:
        'Poll any job: start_video_job, start_music_job, or run_workflow. Returns running (with elapsed time and, ' +
        'for workflow runs, per-node progress), done (with asset urls / node results), or error. Finished results ' +
        'are stored — re-checking a done job is free and idempotent.',
      inputSchema: { jobId: z.string().min(1) },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'check_job', args, async () => {
        const job = jobStore.getJob(args.jobId);
        if (!job) return errorResult(`Job not found: ${args.jobId}`);
        if (job.status === 'done') return jsonResult({ jobId: job.id, status: 'done', ...job.result }, 'Job done');
        if (job.status === 'error') return errorResult(`Job failed: ${job.error}`);

        // Workflow runs are driven in-process: the runner writes progress into
        // the job row, so there is no upstream operation to poll.
        if (job.kind === 'workflow') {
          return jsonResult(
            {
              jobId: job.id,
              status: 'running',
              elapsedSeconds: elapsedSeconds(job.created_at),
              checkAgainInSeconds: 10,
              ...(job.result ?? {}),
            },
            'Workflow running'
          );
        }

        try {
          const operation = await runGeneration({
            method: 'getOperation',
            params:
              job.kind === 'video'
                ? {
                    operation: { name: job.operation_name },
                    projectId: job.project_id,
                    model: job.model,
                    config: (job.params as any).config,
                  }
                : {
                    operation: job.operation_name,
                    _audioModel: job.model,
                    _projectId: job.project_id,
                  },
            userId: ctx.user.id,
            via: 'mcp',
          });

          if (!operation?.done) {
            return jsonResult(
              { jobId: job.id, status: 'running', elapsedSeconds: elapsedSeconds(job.created_at), checkAgainInSeconds: 15 },
              'Still running'
            );
          }

          if (job.kind === 'video') {
            const generated: any[] = operation.response?.generatedVideos ?? [];
            if (!generated.length) {
              jobStore.markError(job.id, 'Operation finished but produced no video (possibly filtered).');
              return errorResult('Job failed: no video produced (possibly filtered).');
            }
            const videos: { url: string; assetId?: string }[] = [];
            for (const v of generated) {
              const uri = v.video?.uri;
              if (!uri) continue;
              const fetched = await runGeneration({
                method: 'fetchVideoFile',
                params: { url: uri, projectId: job.project_id },
                userId: job.user_id,
                via: 'mcp',
              });
              if (fetched?.storageUrl) videos.push({ url: fetched.storageUrl, assetId: fetched.assetId });
            }
            if (!videos.length) {
              jobStore.markError(job.id, 'Video transfer to storage failed.');
              return errorResult('Job failed: video transfer to storage failed.');
            }
            const result = { videos };
            jobStore.markDone(job.id, result);
            return jsonResult({ jobId: job.id, status: 'done', ...result }, 'Video ready');
          }

          // audio (Lyria Pro) — vertexGetOperation already normalized to WAV inlineData
          const inline = operation.response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
          if (!inline?.data) {
            jobStore.markError(job.id, 'Operation finished but produced no audio.');
            return errorResult('Job failed: no audio produced.');
          }
          const uploaded = await uploadBase64(
            job.project_id,
            job.user_id,
            { base64: inline.data, mimeType: inline.mimeType || 'audio/wav', filename: `${Date.now()}-lyria-pro.wav` },
            { metadata: { via: 'mcp' } }
          );
          const result = { audio: { url: uploaded.url, assetId: uploaded.id } };
          jobStore.markDone(job.id, result);
          return jsonResult({ jobId: job.id, status: 'done', ...result }, 'Music ready');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          jobStore.markError(job.id, message);
          throw err;
        }
      })
  );
}
