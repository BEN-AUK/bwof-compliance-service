import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { InfraService } from './infra.service';

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
  /** JSON Schema for structured output; requires responseMimeType: 'application/json'. */
  responseJsonSchema?: object;
}

/**
 * Generic AI service: Gemini client and prompt loading from YAML config.
 * Use for any module that needs AI generation or prompt-by-id lookup.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiApiKey: string;
  private readonly defaultModel: string;
  private readonly defaultTimeoutMs: number;
  private gemini: GoogleGenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly infra: InfraService,
  ) {
    this.geminiApiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.defaultModel =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    this.defaultTimeoutMs =
      Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS')) || 300_000;

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
   * Get prompt, userInstruction, and optional model by ID from YAML config.
   * Entry must be an object with `prompt` and `userInstruction` (non-empty strings).
   * model: optional, from YAML; if absent, use ENV GEMINI_MODEL or default.
   */
  async getPromptAndUserInstructionById(
    promptId: string,
  ): Promise<{ prompt: string; userInstruction: string; model?: string }> {
    const parsed = await this.infra.loadPrompts();
    const entry = parsed[promptId];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new InternalServerErrorException(
        `ai.prompt_not_found: ${promptId}`,
      );
    }
    const obj = entry as Record<string, unknown>;
    const prompt = obj.prompt;
    const userInstruction = obj.userInstruction;
    const model =
      typeof obj.model === 'string' && obj.model.trim().length > 0
        ? obj.model.trim()
        : undefined;
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
      `Loaded prompt+userInstruction '${promptId}' from prompts config`,
    );
    return {
      prompt: trimmedPrompt,
      userInstruction: trimmedUserInstruction,
      ...(model && { model }),
    };
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
      responseJsonSchema,
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
          responseJsonSchema: responseJsonSchema ?? undefined,
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
