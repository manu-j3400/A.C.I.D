"""
Hybrid Model Trainer: Combines Neural Network + Ensemble for maximum accuracy.
Uses a stacking approach where NN predictions become features for the final classifier.
"""

import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from joblib import dump, load
from pathlib import Path


class VulnerabilityNet(nn.Module):
    """Neural network for feature extraction"""
    def __init__(self, input_size, hidden_sizes=None, dropout=0.3):
        super(VulnerabilityNet, self).__init__()
        
        if hidden_sizes is None:
            hidden_sizes = [512, 256, 128, 64]  # Must match saved model checkpoint
        
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_sizes:
            layers.extend([
                nn.Linear(prev_size, hidden_size),
                nn.BatchNorm1d(hidden_size),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            prev_size = hidden_size
        
        layers.append(nn.Linear(prev_size, 1))
        layers.append(nn.Sigmoid())
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)


def get_nn_predictions(model, scaler, X):
    """Get neural network predictions as probabilities"""
    X_scaled = scaler.transform(X)
    X_tensor = torch.FloatTensor(X_scaled)
    
    model.eval()
    with torch.no_grad():
        predictions = model(X_tensor).numpy().flatten()
    
    return predictions


def train_hybrid_model(data_path=None):
    """
    Train a hybrid stacking model: NN predictions + original features -> final classifier
    """
    if data_path is None:
        data_path = Path(__file__).parent.parent / "CSV_master" / "numericFeatures.csv"
    
    print("--- Hybrid Model Training ---")
    
    # Load data
    df = pd.read_csv(data_path)
    X = df.drop(['LABEL', 'SOURCE'], axis=1).values
    y = df['LABEL'].values
    feature_names = df.drop(['LABEL', 'SOURCE'], axis=1).columns.tolist()
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    
    # Load pre-trained neural network
    model_dir = Path(__file__).parent.parent / "ML_master"
    nn_path = model_dir / 'acidModel_neural.pt'
    scaler_path = model_dir / 'acidModel_scaler.pkl'
    
    if nn_path.exists() and scaler_path.exists():
        print("Loading pre-trained neural network...")
        checkpoint = torch.load(nn_path, weights_only=True)
        scaler = load(scaler_path)
        
        nn_model = VulnerabilityNet(
            checkpoint['input_size'],
            checkpoint['hidden_sizes'],
            checkpoint['dropout']
        )
        nn_model.load_state_dict(checkpoint['model_state_dict'])
        
        # Get NN predictions as additional features
        nn_train_preds = get_nn_predictions(nn_model, scaler, X_train)
        nn_test_preds = get_nn_predictions(nn_model, scaler, X_test)
        
        # Augment features with NN predictions
        X_train_aug = np.column_stack([X_train, nn_train_preds])
        X_test_aug = np.column_stack([X_test, nn_test_preds])
        
        print(f"Augmented features: {X_train.shape[1]} original + 1 NN prediction = {X_train_aug.shape[1]}")
    else:
        print("No pre-trained NN found, using original features only")
        X_train_aug = X_train
        X_test_aug = X_test
    
    # Build stacking classifier
    print("\nBuilding Stacking Classifier...")
    
    base_estimators = [
        ('rf', RandomForestClassifier(
            n_estimators=300,
            max_depth=15,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )),
        ('gb', GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        ))
    ]
    
    # Stacking with Logistic Regression as meta-classifier
    stacking_model = StackingClassifier(
        estimators=base_estimators,
        final_estimator=LogisticRegression(max_iter=1000),
        cv=5,
        n_jobs=-1
    )
    
    # Cross-validation
    print("Running 5-fold Cross-Validation...")
    cv_scores = cross_val_score(stacking_model, X_train_aug, y_train, cv=5, scoring='accuracy')
    print(f"CV Accuracy: {cv_scores.mean():.2%} (+/- {cv_scores.std()*2:.2%})")
    
    # Fit the model
    stacking_model.fit(X_train_aug, y_train)
    
    # Evaluate
    y_pred = stacking_model.predict(X_test_aug)
    
    print("\n--- Final Model Evaluation ---")
    print(confusion_matrix(y_test, y_pred))
    print(classification_report(y_test, y_pred))
    
    accuracy = (y_pred == y_test).mean()
    print(f"\nTest Accuracy: {accuracy:.2%}")
    
    # Save the hybrid model
    dump({
        'stacking_model': stacking_model,
        'uses_nn_features': nn_path.exists()
    }, model_dir / 'acidModel_hybrid.pkl')
    
    print(f"\nHybrid model saved to: {model_dir / 'acidModel_hybrid.pkl'}")
    
    return accuracy


if __name__ == "__main__":
    train_hybrid_model()
