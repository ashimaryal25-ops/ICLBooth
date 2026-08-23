import csv
from collections import Counter
from math import exp
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

TRAITS = [
    "Adaptable",
    "Analytical",
    "Bold",
    "Builder",
    "Clutch",
    "Collaborative",
    "Communicator",
    "Creative",
    "Curious",
    "Detail-Oriented",
    "Empathetic",
    "Energetic",
    "Explorer",
    "Innovative",
    "Leader",
    "Mentor",
    "Organized",
    "Performer",
    "Problem Solver",
    "Reliable",
    "Researcher",
    "Storyteller",
    "Strategic",
    "Supportive",
    "Technical",
]

DATA_PATH = Path(__file__).parent / "trait_training_data.csv"
MODEL_PATH = Path(__file__).parent / "models" / "trait_classifier.joblib"


def load_training_data():
    texts = []
    labels = []

    with DATA_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            texts.append(row["text"].strip())
            labels.append(row["label"].strip())

    return texts, labels


def print_dataset_summary(labels):
    label_counts = Counter(labels)

    print(f"Loaded {len(labels)} examples")
    print(f"Found {len(label_counts)} traits")

    print("\nExamples per trait:")
    for trait in TRAITS:
        print(f"- {trait}: {label_counts.get(trait, 0)}")


def validate_labels(labels):
    valid_traits = set(TRAITS)
    labels_in_csv = set(labels)
    unknown_labels = labels_in_csv - valid_traits
    missing_traits = valid_traits - labels_in_csv

    if unknown_labels:
        raise ValueError(f"Unknown labels found: {', '.join(sorted(unknown_labels))}")

    if missing_traits:
        raise ValueError(f"Missing traits: {', '.join(sorted(missing_traits))}")

    print("\nAll labels are valid.")


def build_model():
    return Pipeline([
        ("features", FeatureUnion([
            ("word_tfidf", TfidfVectorizer(
                ngram_range=(1, 3),
                min_df=2,
                max_df=0.9,
                sublinear_tf=True,
            )),
            ("char_tfidf", TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(3, 5),
                min_df=2,
                sublinear_tf=True,
            )),
        ])),
        ("classifier", LinearSVC()),
    ])


def train_model(texts, labels):
    x_train, x_test, y_train, y_test = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    model = build_model()
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"\nTraining split accuracy: {accuracy:.2f}")

    print("\nClassification report:")
    print(classification_report(y_test, predictions))

    return model


def probability_to_card_score(probability, top_probability_sum):
    confidence_share = probability / top_probability_sum if top_probability_sum else 0
    score = 65 + round(confidence_share * 40)

    return max(60, min(99, score))


def get_trait_confidences(model, sentence):
    if hasattr(model, "predict_proba"):
        return model.predict_proba([sentence])[0]

    decision_scores = model.decision_function([sentence])[0]
    max_score = max(decision_scores)
    exponentials = [exp(score - max_score) for score in decision_scores]
    total = sum(exponentials)

    return [value / total for value in exponentials]


def predict_traits(model, sentence, top_n=3):
    probabilities = get_trait_confidences(model, sentence)
    classifier = model.named_steps.get("classifier")
    classes = classifier.classes_ if classifier is not None else model.classes_
    trait_probabilities = list(zip(classes, probabilities))

    trait_probabilities.sort(key=lambda item: item[1], reverse=True)

    top_trait_probabilities = trait_probabilities[:top_n]
    top_probability_sum = sum(probability for _, probability in top_trait_probabilities)

    return [
        {
            "trait": str(trait),
            "probability": float(probability),
            "score": probability_to_card_score(probability, top_probability_sum),
        }
        for trait, probability in top_trait_probabilities
    ]


def main():
    texts, labels = load_training_data()

    print_dataset_summary(labels)
    validate_labels(labels)

    print("\nTraining model...")
    model = train_model(texts, labels)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\nSaved model to: {MODEL_PATH}")

    sample_sentence = "I build quick prototypes and help my team finish under pressure."

    print("\nSample prediction:")
    for prediction in predict_traits(model, sample_sentence):
        print(
            f"- {prediction['trait']}: "
            f"{prediction['score']} "
            f"(confidence {prediction['probability']:.2f})"
        )


if __name__ == "__main__":
    main()
