import type {
  AnswerSourceDocument,
  EmbeddingClient,
  RetrievedDocumentChunk
} from "../types.js";
import {
  RagRetrievalRepository,
  sourcesFromRetrievedChunks
} from "./persistence.js";

export interface RagRetrieverOptions {
  indexVersion: string;
  embeddingModel: string;
  embeddingDimensions: number;
  retrievalLimit: number;
  retrievalCandidateLimit: number;
  minSimilarity: number;
  exactMatchBoost: number;
}

export interface RagRetrieverDependencies {
  embeddings: EmbeddingClient;
  repository: RagRetrievalRepository;
  options: RagRetrieverOptions;
}

export interface RetrieveQuestionContextResult {
  chunks: RetrievedDocumentChunk[];
  sources: AnswerSourceDocument[];
  indexedChunkCount: number;
}

export class RagRetriever {
  constructor(private readonly deps: RagRetrieverDependencies) {}

  async retrieve(question: string): Promise<RetrieveQuestionContextResult> {
    const trimmed = question.trim();
    if (!trimmed) {
      return {
        chunks: [],
        sources: [],
        indexedChunkCount: 0
      };
    }

    const indexedChunkCount = await this.deps.repository.countIndexedChunks(
      this.deps.options.indexVersion,
      this.deps.options.embeddingModel,
      this.deps.options.embeddingDimensions
    );
    if (indexedChunkCount === 0) {
      return {
        chunks: [],
        sources: [],
        indexedChunkCount
      };
    }

    const embedding = await this.deps.embeddings.createEmbeddings({ input: [trimmed] });
    const queryEmbedding = embedding.embeddings[0];
    if (!queryEmbedding) {
      throw new Error("OpenAI did not return a query embedding.");
    }

    const chunks = await this.deps.repository.searchRelevantChunks(
      queryEmbedding,
      exactTermsFromQuestion(trimmed),
      {
        indexVersion: this.deps.options.indexVersion,
        embeddingModel: this.deps.options.embeddingModel,
        embeddingDimensions: this.deps.options.embeddingDimensions,
        candidateLimit: this.deps.options.retrievalCandidateLimit,
        limit: this.deps.options.retrievalLimit,
        minSimilarity: this.deps.options.minSimilarity,
        exactMatchBoost: this.deps.options.exactMatchBoost
      }
    );

    return {
      chunks,
      sources: sourcesFromRetrievedChunks(chunks),
      indexedChunkCount
    };
  }
}

export function exactTermsFromQuestion(question: string): string[] {
  const terms = question
    .toLowerCase()
    .match(/[a-zа-яё0-9]+(?:[./-][a-zа-яё0-9]+)*/giu);

  if (!terms) {
    return [];
  }

  return [...new Set(terms.filter(isUsefulExactTerm))];
}

function isUsefulExactTerm(term: string): boolean {
  if (/\d/.test(term)) {
    return term.length >= 2;
  }

  return term.length >= 3;
}
