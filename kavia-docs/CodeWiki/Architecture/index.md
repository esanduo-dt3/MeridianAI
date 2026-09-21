[CodeWiki](../index.md) / [Architecture](index.md)

# Architecture

This section describes MeridianAI as it is implemented in the repository today. The pages are written from the source code, the database migrations, and the frontend components rather than from the original plan, and they call out explicitly where an earlier document records a target rather than verified behavior.

## Pages

| Page | Scope |
| --- | --- |
| [System Architecture and RAG Pipeline](system-architecture-and-rag-pipeline.md) | Request scoping and authorization, document ingestion and chunking, hybrid retrieval with fusion and reranking, the confidence gate, answer generation and its trust signals, the agent tool loop and human approval, the model gateway, and administrative oversight. |
| [Frontend UI Architecture](frontend-ui-architecture.md) | The React application shell, the page-frame system, the design tokens and glass material, the public landing page, route composition, and the interaction regression suites produced by the UI/UX work. |

## Related Reference Material

The engineer-facing reference pages under `docs/architecture/` cover the same system in more granular form, including the data model, the endpoint list, every tuned pipeline parameter, and a standing review of pipeline weaknesses. The design system is documented in `docs/design/design-system.md`, and every deviation from the product requirements is recorded in `docs/decisions.md`.
