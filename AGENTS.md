# Architecture rules

- Keep all AI model identifiers in `src/lib/ai-models.ts`; fast tasks use the Lovable AI Gateway's compatible chat client, while long-form reasoning uses the Responses API.
- Read gateway secrets only inside authenticated server-function handlers and keep model requests, prompts, and source material on the server.