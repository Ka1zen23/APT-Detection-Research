
from pathlib import Path
import argparse

import evaluate as base


ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--experiment",
        choices=[
   		 "e2b-unique",
   		 "e2c-weighted",
   		 "e2d-unique-matched",
	],
        required=True,
    )

    args = parser.parse_args()

    experiment = args.experiment

    base.MODEL_PATH = (
        ROOT / "models" / experiment
        / "autoencoder.pt"
    )

    base.OUTPUT = (
        ROOT / "results" / experiment
        / "evaluation"
    )

    base.main()


if __name__ == "__main__":
    main()
