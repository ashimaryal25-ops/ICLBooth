import argparse
import json

import joblib

from trait_classifier import MODEL_PATH, predict_traits


def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found at {MODEL_PATH}. "
            "Run `python ml/trait_classifier.py` first to train and save it."
        )

    return joblib.load(MODEL_PATH)


def print_prediction(model, sentence):
    predictions = predict_traits(model, sentence)

    print("\nPredicted traits:")
    for prediction in predictions:
        print(
            f"- {prediction['trait']}: "
            f"{prediction['score']} "
            f"(confidence {prediction['probability']:.2f})"
        )


def parse_args():
    parser = argparse.ArgumentParser(description="Predict CardifyBooth traits.")
    parser.add_argument("--text", help="Self-description to classify.")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print predictions as JSON instead of interactive text.",
    )

    return parser.parse_args()


def main():
    args = parse_args()
    model = load_model()

    if args.text is not None:
        output = {
            "safe": True,
            "message": None,
            "traits": predict_traits(model, args.text),
        }

        if args.json:
            print(json.dumps(output))
        else:
            print_prediction(model, args.text)

        return

    print(f"Loaded saved model from: {MODEL_PATH}")

    while True:
        sentence = input("\nDescribe yourself, or type quit: ").strip()

        if sentence.lower() == "quit":
            break

        if not sentence:
            print("Type at least one sentence.")
            continue

        print_prediction(model, sentence)


if __name__ == "__main__":
    main()
