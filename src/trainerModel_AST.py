import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from joblib import dump
from pathlib import Path


# load the numeric features csv
# data_path = "/User/manujawahar/workspace/ACID/CSV_master/numericFeatures.csv"

def modelTrainer(data_path = "/Users/manujawahar/workspace/ACID/CSV_master/numericFeatures.csv"):
    df = pd.read_csv(data_path)

    # Prepare X(features) and y (Target Label)
    # drop LABEL because thats the answer and SOURCE b/c its just txt (columns)
    X = df.drop(['LABEL', 'SOURCE'], axis=1)
    y = df['LABEL'] # just the columns

    # time to split the training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)


    # initalizing and training the Random Forest
    print("  Training the Random Forest Model  ")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # PREDICTION TIME
    y_predictions = model.predict(X_test)

    print("Model Evaluation")
    print(confusion_matrix(y_test, y_predictions))
    print(classification_report(y_test, y_predictions))

    # saving the model for later use
    modelDir = Path("/Users/manujawahar/workspace/ACID/ML_master/")
    modelDir.mkdir(parents=True, exist_ok=True)

    # full file path
    modelPath = modelDir / 'acidModel.pkl'  # <---- pickel format

    dump(model, modelPath)

    print(f"Model exported to: {modelPath}")




