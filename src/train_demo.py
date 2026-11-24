
import torch
import torch.nn as nn
import numpy as np
import matplotlib.pyplot as plt

from sentence_transformers import SentenceTransformer
from autoencoder import Autoencoder

# Reproducibility
torch.manual_seed(42)
np.random.seed(42)

device = "cuda" if torch.cuda.is_available() else "cpu"

print("Using device:", device)

# Load the pretrained embedding model
embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device=device
)

# Synthetic benign training data
normal_events = [
    "A Python process reads a configuration file.",
    "A system service writes application logs.",
    "A web browser loads a local cache file.",
    "A database service reads a database record.",
    "A user opens a text document.",
    "A scheduled service creates a backup file.",
    "An application reads its settings file.",
    "A system process checks available disk space.",
    "A web server handles an incoming request.",
    "A service writes a temporary file.",
    "An application loads a shared library.",
    "A database service updates a record.",
    "A user saves a spreadsheet.",
    "A system service rotates log files.",
    "A process reads an application resource."
]

# Separate benign validation data
validation_events = [
    "A service reads its configuration settings.",
    "A user saves a text file.",
    "A database reads stored information.",
    "A system process writes diagnostic logs.",
    "An application creates a temporary cache."
]

# Convert normal events into embeddings
train_embeddings = embedding_model.encode(
    normal_events,
    normalize_embeddings=True,
    convert_to_tensor=True
).clone().detach().to(device)

validation_embeddings = embedding_model.encode(
    validation_events,
    normalize_embeddings=True,
    convert_to_tensor=True
).clone().detach().to(device)

# Initialise our custom AI model
model = Autoencoder().to(device)

print("\nEmbedding diagnostics:")
print("Training shape:", train_embeddings.shape)
print("Validation shape:", validation_embeddings.shape)
print("Device:", train_embeddings.device)
print("Inference tensor:", train_embeddings.is_inference())
print("Requires gradient:", train_embeddings.requires_grad)

print("Trainable parameters:", sum(
    p.numel()
    for p in model.parameters()
    if p.requires_grad
))

criterion = nn.MSELoss()

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=0.001
)

epochs = 200
loss_history = []

print("\nStarting autoencoder training...\n")

# Training loop
for epoch in range(epochs):

    model.train()

    reconstructed = model(train_embeddings)

    loss = criterion(
        reconstructed,
        train_embeddings
    )

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    loss_history.append(loss.item())

    if (epoch + 1) % 20 == 0:
        print(
            f"Epoch {epoch + 1}/{epochs} "
            f"| Loss: {loss.item():.8f}"
        )

# Establish threshold using validation data
model.eval()

with torch.no_grad():

    reconstructed = model(validation_embeddings)

    validation_errors = torch.mean(
        (validation_embeddings - reconstructed) ** 2,
        dim=1
    )

threshold = float(np.percentile(
    validation_errors.cpu().numpy(),
    95
))

# Save model and threshold
torch.save(
    {
        "model_state_dict": model.state_dict(),
        "threshold": threshold,
        "input_dim": 384
    },
    "models/autoencoder_demo.pt"
)

print("\nTraining completed.")
print("Anomaly threshold:", threshold)
print("Model saved successfully.")

# Generate training graph
plt.figure(figsize=(10, 5))
plt.plot(loss_history)
plt.xlabel("Epoch")
plt.ylabel("Reconstruction Loss")
plt.title("Autoencoder Training Loss")
plt.grid(True)
plt.tight_layout()
plt.savefig("results/training_loss_demo.png")

print("Training graph saved.")

