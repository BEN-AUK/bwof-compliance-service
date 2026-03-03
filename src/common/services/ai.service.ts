import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { parse as parseYaml } from 'yaml';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_PROMPTS_CONFIG = 'config/prompts.yaml';

/** Optional extra parts (e.g. inlineData for image) for Gemini user message. */
export interface GenerateContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/** Options for the generic generateContent call. */
export interface GenerateContentOptions {
  systemPrompt: string;
  userInstruction: string;
  extraParts?: GenerateContentPart[];
  model?: string;
  timeoutMs?: number;
  responseMimeType?: 'application/json' | null;
}

/**
 * Generic AI service: Gemini client and prompt loading from YAML config.
 * Use for any module that needs AI generation or prompt-by-id lookup.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiApiKey: string;
  private readonly promptsConfigPath: string;
  private readonly defaultModel: string;
  private readonly defaultTimeoutMs: number;
  private gemini: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {
    this.geminiApiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.promptsConfigPath =
      this.config.get<string>('PROMPTS_CONFIG_FILE') ??
      join(process.cwd(), DEFAULT_PROMPTS_CONFIG);
    this.defaultModel =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    this.defaultTimeoutMs =
      Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS')) || 30_000;

    if (!this.geminiApiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not configured, AI generation will be unavailable',
      );
    }
  }

  /** Google Gemini client for AI generation. */
  getGemini(): GoogleGenAI {
    if (!this.gemini) {
      if (!this.geminiApiKey) {
        throw new InternalServerErrorException('ai.gemini_not_configured');
      }
      this.gemini = new GoogleGenAI({ apiKey: this.geminiApiKey });
    }
    return this.gemini;
  }

  /**
   * Get prompt by ID from YAML config; throws if ID not found or file read fails.
   */
  async getPromptById(promptId: string): Promise<string> {
    const { prompt } = await this.getPromptAndUserInstructionById(promptId);
    return prompt;
  }

  /**
   * Get prompt and userInstruction by ID from YAML config.
   * Entry must be an object with `prompt` and `userInstruction` (non-empty strings).
   */
  async getPromptAndUserInstructionById(
    promptId: string,
  ): Promise<{ prompt: string; userInstruction: string }> {
    const content = await readFile(this.promptsConfigPath, 'utf-8');
    const parsed = parseYaml(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      throw new InternalServerErrorException(
        `ai.prompts_config_invalid: ${this.promptsConfigPath}`,
      );
    }
    const entry = parsed[promptId];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new InternalServerErrorException(
        `ai.prompt_not_found: ${promptId}`,
      );
    }
    const obj = entry as Record<string, unknown>;
    const prompt = obj.prompt;
    const userInstruction = obj.userInstruction;
    if (typeof prompt !== 'string' || typeof userInstruction !== 'string') {
      throw new InternalServerErrorException(
        `ai.prompt_entry_invalid: ${promptId} (must have prompt and userInstruction strings)`,
      );
    }
    const trimmedPrompt = prompt.trim();
    const trimmedUserInstruction = userInstruction.trim();
    if (trimmedPrompt.length === 0 || trimmedUserInstruction.length === 0) {
      throw new InternalServerErrorException(`ai.prompt_empty: ${promptId}`);
    }
    this.logger.debug(
      `Loaded prompt+userInstruction '${promptId}' from ${this.promptsConfigPath}`,
    );
    return { prompt: trimmedPrompt, userInstruction: trimmedUserInstruction };
  }

  /**
   * Generic Gemini generateContent: systemPrompt + userInstruction + optional extraParts (e.g. image),
   * with timeout and optional JSON response. Returns raw response text.
   */
  async generateContent(options: GenerateContentOptions): Promise<string> {
    const {
      systemPrompt,
      userInstruction,
      extraParts,
      model = this.defaultModel,
      timeoutMs = this.defaultTimeoutMs,
      responseMimeType = null,
    } = options;

    const ai = this.getGemini();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const textPart = { text: `${systemPrompt}\n\n${userInstruction}` };
      const parts = [textPart, ...(extraParts ?? [])];

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: responseMimeType ?? undefined,
          abortSignal: controller.signal,
        },
      });

      clearTimeout(timeoutId);

      const raw = response.text;
      if (!raw || typeof raw !== 'string') {
        throw new BadGatewayException('ai.empty_response');
      }
      return raw;
    } catch (err) {
      clearTimeout(timeoutId);
      if ((err as Error)?.name === 'AbortError') {
        throw new BadGatewayException(`ai.timeout (${timeoutMs}ms)`);
      }
      throw err;
    }
  }
}
