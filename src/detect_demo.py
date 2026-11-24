
import torch

from sentence_transformers import SentenceTransformer
from autoencoder import Autoencoder

# Select GPU or CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", device)

# Load pretrained MiniLM
embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device=device
)

# Load the trained autoencoder checkpoint
checkpoint = torch.load(
    "models/autoencoder_demo.pt",
    map_location=device,
    weights_only=True
)

model = Autoencoder(
    input_dim=checkpoint["input_dim"]
).to(device)

model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

threshold = checkpoint["threshold"]

# Previously unseen system activities
test_events = [
    "A user opens a spreadsheet document.",
    "A service writes routine diagnostic logs.",
    "An application reads its configuration.",
    "A database service retrieves a record.",
    "A process accesses stored credentials.",
    "A process modifies system security settings.",
    "An application establishes an external connection.",
    "A process transfers confidential files."
]

# Generate embeddings
embeddings = embedding_model.encode(
    test_events,
    normalize_embeddings=True,
    convert_to_tensor=True
).clone().detach().to(device)

# Calculate reconstruction errors
with torch.no_grad():
    reconstructed = model(embeddings)

    errors = torch.mean(
        (embeddings - reconstructed) ** 2,
        dim=1
    )

# Display detection results
print(f"\nAnomaly threshold: {threshold:.8f}")
print("=" * 65)

normal_count = 0
anomaly_count = 0

for event, error in zip(test_events, errors):
    score = error.item()

    if score > threshold:
        status = "ANOMALOUS"
        anomaly_count += 1
    else:
        status = "NORMAL"
        normal_count += 1

    print(f"\nEvent: {event}")
    print(f"Reconstruction error: {score:.8f}")
    print(f"Classification: {status}")

print("\n" + "=" * 65)
print("DETECTION SUMMARY")
print(f"Total events: {len(test_events)}")
print(f"Normal events: {normal_count}")
print(f"Anomalous events: {anomaly_count}")
