## Purpose

Define how Genadiy answers Telegram questions using processed raw text from uploaded documents and the DeepSeek API.

## Requirements

### Requirement: Authorized Telegram Questions
The system SHALL answer document questions only from Telegram users whose numeric user IDs are configured in the allowlist.

#### Scenario: Allowlisted user asks a question
- **WHEN** an allowlisted Telegram user sends a text question
- **THEN** the system processes the question through document question answering

#### Scenario: Non-allowlisted user asks a question
- **WHEN** a Telegram user not present in the allowlist sends a text question
- **THEN** the system rejects the message without loading documents or calling DeepSeek

### Requirement: Question Input Routing
The system SHALL route Telegram uploads to ingestion and route text questions to document question answering without breaking existing upload behavior.

#### Scenario: User sends an upload
- **WHEN** an allowlisted user sends a Telegram `document` or `photo` message
- **THEN** the system handles it with the existing upload ingestion flow

#### Scenario: User sends a plain text question
- **WHEN** an allowlisted user sends a non-command text message
- **THEN** the system treats the message text as a document question

#### Scenario: User sends ask command
- **WHEN** an allowlisted user sends `/ask` followed by question text
- **THEN** the system treats the command argument as a document question

### Requirement: Raw Text Corpus Answers
The system SHALL answer questions using processed document-level `rawText` records stored in PostgreSQL for the requesting Telegram sender.

#### Scenario: Processed text exists
- **WHEN** the requesting sender has one or more processed document text records
- **THEN** the system builds a DeepSeek request containing those raw text records and source labels

#### Scenario: No processed text exists
- **WHEN** the requesting sender has no processed document text records
- **THEN** the system replies that no processed document text is available

### Requirement: All-Documents V1 Context
The system SHALL include all available processed document text for the requesting sender unless the assembled corpus exceeds the configured context guardrail.

#### Scenario: Corpus is within guardrail
- **WHEN** the assembled document text is within `DEEPSEEK_MAX_CONTEXT_CHARS`
- **THEN** the system sends the complete assembled corpus to DeepSeek

#### Scenario: Corpus exceeds guardrail
- **WHEN** the assembled document text exceeds `DEEPSEEK_MAX_CONTEXT_CHARS`
- **THEN** the system does not call DeepSeek and replies that the document corpus is too large for the current v1 question answering mode

### Requirement: DeepSeek Grounded Answers
The system SHALL call DeepSeek Chat Completions API and instruct it to answer only from the supplied document text.

#### Scenario: DeepSeek returns an answer
- **WHEN** DeepSeek returns a successful completion
- **THEN** the system replies to Telegram with the generated answer after the API call succeeds

#### Scenario: Answer is not in documents
- **WHEN** the supplied document text does not contain enough information to answer
- **THEN** the system instructs DeepSeek to say that the answer is not present in the uploaded documents

#### Scenario: DeepSeek request fails
- **WHEN** DeepSeek returns an error or the request times out
- **THEN** the system replies that the question could not be answered at this time

### Requirement: DeepSeek Configuration
The system SHALL validate DeepSeek-related configuration before starting question answering.

#### Scenario: API key is missing
- **WHEN** `DEEPSEEK_API_KEY` is not configured
- **THEN** the system disables question answering startup with a clear configuration error

#### Scenario: Configuration is present
- **WHEN** DeepSeek configuration values are present and valid
- **THEN** the system starts with document question answering enabled

### Requirement: Question Answer Privacy
The system SHALL NOT log raw document text or full DeepSeek prompts during question answering.

#### Scenario: Question is answered
- **WHEN** the system builds and sends a DeepSeek prompt
- **THEN** runtime logs do not include raw document text or the full prompt payload
