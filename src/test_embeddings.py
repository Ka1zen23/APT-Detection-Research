
import torch
from sentence_transformers import SentenceTransformer

# Select GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Using device: {device}")

# Download and load pretrained AI model
model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device=device
)

# Sample system activities
events = [
    "A Python process reads a configuration file.",
    "A Python application opens a configuration file.",
    "A system service writes routine application logs.",
    "An unknown process accesses sensitive credentials.",
    "An unexpected application establishes an external connection."
]

# Convert text into numerical embeddings
embeddings = model.encode(
    events,
    normalize_embeddings=True,
    show_progress_bar=True
)

print("\nEmbedding shape:", embeddings.shape)

for event, embedding in zip(events, embeddings):
    print(f"\nEvent: {event}")
    print(f"Dimensions: {len(embedding)}")
    print(f"First 5 values: {embedding[:5]}")

# Compare semantic similarity
similarities = model.similarity(embeddings, embeddings)

print("\nSemantic similarity matrix:")
print(similarities)
