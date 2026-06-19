## 1. Configuration And DeepSeek Client

- [x] 1.1 Add DeepSeek configuration validation and `.env.example` entries.
- [x] 1.2 Implement a DeepSeek chat completions client with timeout and typed errors.

## 2. Document Question Answering Service

- [x] 2.1 Add repository access for processed raw document text by Telegram sender.
- [x] 2.2 Implement prompt/corpus assembly with source labels and context size enforcement.
- [x] 2.3 Implement the question answering service using DeepSeek responses and safe failure messages.

## 3. Telegram Integration

- [x] 3.1 Route uploads to existing ingestion and text questions to the Q&A handler.
- [x] 3.2 Add `/start` and `/ask` behavior without breaking authorization or uploads.
- [x] 3.3 Split or constrain Telegram replies so long answers are delivered safely.

## 4. Tests And Documentation

- [x] 4.1 Add unit tests for DeepSeek config validation and client request mapping.
- [x] 4.2 Add unit tests for corpus loading, context guardrail, and prompt construction.
- [x] 4.3 Add unit tests for Telegram routing, unauthorized questions, no-documents behavior, and DeepSeek failure behavior.
- [x] 4.4 Document deployment, privacy implications, and manual verification steps for question answering.

## 5. Validation

- [x] 5.1 Run OpenSpec validation.
- [x] 5.2 Run TypeScript build/type checks and the relevant test suite.
