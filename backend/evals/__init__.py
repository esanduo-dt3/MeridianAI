"""Offline evaluation harness for Gate G1 (docs/product/overview.md).

Run from `backend/` with the project virtualenv:

    .venv/bin/python -m evals.ingest    --folder ../golden-docs --workspace <id>
    .venv/bin/python -m evals.validate  --workspace <id>
    .venv/bin/python -m evals.run       --workspace <id> --retrieval-only
    .venv/bin/python -m evals.run       --workspace <id>
    .venv/bin/python -m evals.report    --results evals/results/<file>.json
"""
