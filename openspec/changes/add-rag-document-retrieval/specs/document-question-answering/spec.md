## MODIFIED Requirements

### Requirement: Raw Text Corpus Answers
The system SHALL answer questions using retrieved RAG chunks from processed document text stored in PostgreSQL.

#### Scenario: Retrieved context exists
- **WHEN** the retrieval system returns relevant chunks for a question
- **THEN** the system builds a DeepSeek request containing only those chunks and their source labels

#### Scenario: No processed text exists
- **WHEN** there are no indexed document chunks available
- **THEN** the system replies that no processed document context is available

#### Scenario: No relevant chunks exist
- **WHEN** processed chunks exist but retrieval finds no relevant context
- **THEN** the system replies that it could not find relevant document context for the question

### Requirement: DeepSeek Grounded Answers
The system SHALL call DeepSeek Chat Completions API and instruct it to answer only from the retrieved RAG context.

#### Scenario: DeepSeek returns an answer
- **WHEN** DeepSeek returns a successful completion based on retrieved context
- **THEN** the system replies to Telegram with the generated answer after the API call succeeds

#### Scenario: Answer is not in retrieved context
- **WHEN** the retrieved context does not contain enough information to answer
- **THEN** the system instructs DeepSeek to say that the answer is not present in the uploaded documents

#### Scenario: DeepSeek request fails
- **WHEN** DeepSeek returns an error or the request times out
- **THEN** the system replies that the question could not be answered at this time

## ADDED Requirements

### Requirement: Downloadable Answer Sources
The system SHALL provide the original stored documents used as answer sources to allowlisted Telegram users.

#### Scenario: Answer uses source documents
- **WHEN** retrieved chunks from one or more uploads are used in an answer
- **THEN** the system sends the original source documents back to the Telegram chat after the answer

#### Scenario: Source document cannot be downloaded
- **WHEN** object storage download fails for an answer source
- **THEN** the system logs the source download failure and continues delivering the answer

### Requirement: Shared Allowlisted Document Visibility
The system SHALL search indexed documents across all allowlisted users' uploads when an allowlisted user asks a question.

#### Scenario: Different allowlisted user uploaded relevant document
- **WHEN** a relevant document was uploaded by another allowlisted user
- **THEN** the system may retrieve that document's chunks and use them in the answer

## REMOVED Requirements

### Requirement: All-Documents V1 Context
**Reason**: RAG retrieval replaces sending the full processed corpus to DeepSeek.
**Migration**: Use RAG chunk retrieval and retrieval context limits instead of `DEEPSEEK_MAX_CONTEXT_CHARS` for all-document prompts.
