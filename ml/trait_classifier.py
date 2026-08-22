import csv
from collections import Counter
from math import exp
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

TRAITS = [
    "Builder",
    "Creative",
    "Leader",
    "Clutch",
    "Supportive",
    "Analytical",
    "Energetic",
    "Technical",
]


DATA_PATH = Path(__file__).parent / "trait_training_data.csv"
MODEL_PATH = Path(__file__).parent / "models" / "trait_classifier.joblib"


def load_training_data():
    texts = []
    labels = []

    with DATA_PATH.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            text = row["text"].strip()
            label = row["label"].strip()

            texts.append(text)
            labels.append(label)

    return texts, labels


def print_dataset_summary(labels):
    label_counts = Counter(labels)

    print(f"Loaded {len(labels)} examples")
    print(f"Found {len(label_counts)} traits")

    print("\nExamples per trait:")
    for trait in TRAITS:
        count = label_counts.get(trait, 0)
        print(f"- {trait}: {count}")


def validate_labels(labels):
    valid_traits = set(TRAITS)
    labels_in_csv = set(labels)

    unknown_labels = labels_in_csv - valid_traits
    missing_traits = valid_traits - labels_in_csv

    if unknown_labels:
        print("\nUnknown labels found:")
        for label in sorted(unknown_labels):
            print(f"- {label}")

    if missing_traits:
        print("\nMissing traits:")
        for trait in sorted(missing_traits):
            print(f"- {trait}")

    if not unknown_labels and not missing_traits:
        print("\nAll labels are valid.")

def train_model(texts, labels):
    x_train, x_test, y_train, y_test = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    model = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
        ("classifier", LogisticRegression(max_iter=1000)),
    ])

    model.fit(x_train, y_train)

    predictions = model.predict(x_test)

    accuracy = accuracy_score(y_test, predictions)
    print(f"\nAccuracy: {accuracy:.2f}")

    print("\nClassification report:")
    print(classification_report(y_test, predictions))

    return model

def probability_to_card_score(probability, top_probability_sum):
    confidence_share = probability / top_probability_sum
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
    trait_probabilities = list(zip(model.classes_, probabilities))

    trait_probabilities.sort(key=lambda item: item[1], reverse=True)

    top_trait_probabilities = trait_probabilities[:top_n]
    top_probability_sum = sum(probability for _, probability in top_trait_probabilities)

    top_traits = []

    for trait, probability in top_trait_probabilities:
        top_traits.append({
            "trait": trait,
            "probability": probability,
            "score": probability_to_card_score(probability, top_probability_sum),
        })

    return top_traits

def print_wrong_predictions(model, texts, labels, max_rows=40):
    predictions = model.predict(texts)

    print(f"\nWrong predictions, first {max_rows}:")
    shown = 0

    for text, actual_label, predicted_label in zip(texts, labels, predictions):
        if actual_label == predicted_label:
            continue

        print("\n---")
        print(f"Text: {text}")
        print(f"Expected: {actual_label}")
        print(f"Predicted: {predicted_label}")

        shown += 1

        if shown >= max_rows:
            break

    if shown == 0:
        print("No wrong predictions found.")

        
def main():
    texts, labels = load_training_data()

    print_dataset_summary(labels)
    validate_labels(labels)

    print("\nTraining model...")
    model = train_model(texts, labels)

    sample_sentence = "I build quick prototypes and help my team finish under pressure."

    print("\nSample prediction:")
    predicted_traits = predict_traits(model, sample_sentence)

    for trait in predicted_traits:
        print(
            f"- {trait['trait']}: "
            f"{trait['score']} "
            f"(confidence {trait['probability']:.2f})"
        )
    while True:
        user_sentence = input("\nDescribe yourself, or type quit: ").strip()

        if user_sentence.lower() == "quit":
            break

        predicted_traits = predict_traits(model, user_sentence)

        print("\nPredicted traits:")
        for trait in predicted_traits:
            print(
                f"- {trait['trait']}: "
                f"{trait['score']} "
                f"(confidence {trait['probability']:.2f})"
            )


if __name__ == "__main__":
    main()
