# Agent Instructions — APT Detection Research

## 1. Mission and scope

Support the research titled **AI-based solution to detect and mitigate APT malware**. Prioritise defensible research methodology, reproducibility, explainability and beginner-friendly implementation over feature count or impressive-looking metrics. The researcher has software development experience and is learning machine learning.

Read README.md and inspect the actual repository before editing. Treat this document as project guidance, not proof that planned files or features exist. Follow explicit user instructions and approved research requirements; flag conflicts rather than silently changing methodology.

## 2. Current state

The synthetic proof of concept has run successfully on CUDA in WSL2 Ubuntu 24.04 with Python 3.12 and an RTX 4060 (8 GB VRAM). Current files: src/test_embeddings.py, src/autoencoder.py, src/train_demo.py, src/detect_demo.py. Training uses frozen MiniLM, 384-dimensional normalised embeddings and a 384→128→32→128→384 MLP with 107,168 trainable parameters. The demo used 15 benign training examples, 5 benign validation examples and 8 unseen test examples. Final training loss: 0.00000388; threshold: 0.0010196679504588246; predictions: 4 normal, 4 anomalous. These are demonstration results, not validated malware detection metrics.

Next priority: dataset acquisition, schema inspection and experimental design. Do not jump directly to a dashboard or generative LLM integration.

## 3. Architecture and technology decisions

- Python 3.12, PyTorch, sentence-transformers, NumPy, Pandas, PyArrow, scikit-learn, Matplotlib and pytest.
- Use MiniLM as the current lightweight encoder. Keep it frozen by default. Consider BERT/MPNet as controlled comparisons; obtain approval for substantive proposal changes, including framework changes.
- Use CUDA when available and support CPU fallback. Avoid assuming unlimited RAM or VRAM; batch embeddings and stream/chunk large datasets.
- Preserve the separation of ingestion, verbalisation, embedding, training, calibration, inference, evaluation and mitigation.
- Do not add Ollama, large generative models, databases, Docker or frontend frameworks unless a justified research need is approved.
- Never treat anomaly detection as definitive malware classification or APT attribution.

## 4. Repository conventions

- data/raw/: immutable original dataset files; never edit in place.
- data/processed/: derived records and split manifests.
- data/embeddings/: cached vectors and encoder/preprocessing metadata.
- src/: reusable implementation and entry points.
- notebooks/: exploration, not the sole implementation of critical experiments.
- models/: generated checkpoints and associated metadata.
- experiments/: configurations and run manifests.
- results/: metrics, tables and plots.
- tests/: automated tests and small synthetic fixtures.
- knowledge/: verified ATT&CK/D3FEND references and mitigation rules.

Keep the existing demo scripts functional. Introduce new modules incrementally. Use pathlib, clear snake_case names, type hints where useful, focused functions and comments explaining ML decisions. Prefer configuration over scattered hardcoded values. Avoid unnecessary abstractions.

## 5. Dataset and preprocessing rules

Inspect the CICAPT-IIoT dataset documentation, licence, actual files, labels and provenance schema before implementing parsers. Never invent column names, label mappings, download URLs or dataset statistics. Preserve source IDs, timestamps, event types and provenance relationships where available. Document missing data and transformations.

Use deterministic natural-language templates grounded in observed fields. Do not insert words such as malicious, suspicious, benign or attack into model inputs based on ground-truth labels. Avoid leaking scenario identifiers, filenames or other label proxies. Preserve labels separately for evaluation. Do not discard context or deduplicate events without documenting the rationale.

## 6. Experimental integrity

- Define the unit of detection (event, sequence or graph/window) explicitly.
- Split by appropriate host, session, scenario or time groups where supported; avoid random event-level leakage and near-duplicate overlap.
- Train the autoencoder on benign training records only. Fit preprocessing and baseline models using training data only.
- Use separate benign validation data for threshold calibration; do not tune on the final test set.
- Treat the 95th percentile as an initial experimental choice, not a universal threshold. Report the calibration method and sample size.
- Keep the final test set held out. Report precision, recall, F1, ROC-AUC, average precision/PR-AUC, confusion matrix, class counts and false-positive rate where applicable.
- Compare against meaningful simpler baselines under consistent splits and metrics (e.g. TF-IDF, PCA reconstruction, Isolation Forest).
- Record random seeds, dependency versions, dataset version/hash, encoder revision, split identifiers, hyperparameters, hardware and checkpoint metadata. Seeds alone do not guarantee GPU determinism.
- Report limitations, failed experiments and negative results. Never fabricate metrics, sources or experimental success.

## 7. PyTorch implementation requirements

SentenceTransformer.encode may return inference tensors. For autoencoder training, clone outside inference mode and detach before using them in autograd:

```python
embeddings = encoder.encode(
    descriptions,
    normalize_embeddings=True,
    convert_to_tensor=True,
).clone().detach().to(device)
```

Keep the encoder frozen. Use model.train() during training and model.eval() with torch.no_grad() or inference_mode() during evaluation. Compute per-sample reconstruction error consistently using mean squared error across embedding dimensions. Save model state_dict, architecture, threshold, encoder identifier/revision and preprocessing configuration together for real experiments. Load trusted checkpoints only; prefer weights_only=True where supported.

## 8. Mitigation and safety

Work only on defensive, authorised research. Do not execute live malware on the development host, connect to unauthorised systems, or implement autonomous destructive responses. Future mitigation recommendations should cite observed evidence, distinguish uncertainty, map to verified ATT&CK/D3FEND information where justified, and require human review. Do not infer a specific technique from a single anomaly score. Evaluate mitigation separately from detection; offline anomaly scores cannot demonstrate mitigation effectiveness.

Never commit secrets, tokens, sensitive telemetry, raw restricted datasets or large generated checkpoints. Keep generated artifacts ignored where appropriate. Verify licences before sharing data or code.

## 9. Agent workflow

1. Inspect relevant files, git status and existing tests before changes.
2. Explain the proposed change and why it matters to the research. Ask before major scope or methodology changes.
3. Implement the smallest coherent change, preserving unrelated user work.
4. Add tests for parsing, shapes, split isolation, threshold boundaries and checkpoint round trips where relevant.
5. Run targeted tests or smoke checks when possible; report actual commands and results. Never claim tests were run if they were not.
6. Update README.md and experiment metadata when behaviour or results change. Keep this file aligned with durable project decisions.
7. Summarise changed files, assumptions, limitations and the next practical step in plain English.

Avoid destructive Git commands, unapproved dependency upgrades and large downloads without checking user intent. Do not overwrite existing experiment outputs without explicit permission; use distinct run identifiers.

## 10. Definition of done

A change is complete when it satisfies the requested scope, has appropriate verification, preserves research integrity, documents assumptions and can be understood and reproduced by the researcher. A successful synthetic demo is not a completed research project.
