"""
Neural Network Classifier for Code Vulnerability Detection
Uses PyTorch to train a deep learning model on AST features.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from joblib import dump, load
from pathlib import Path


class VulnerabilityNet(nn.Module):
    """
    A simple feedforward neural network for binary classification.
    Architecture: Input -> Hidden1 -> Hidden2 -> Hidden3 -> Output
    """
    def __init__(self, input_size, hidden_sizes=[128, 64, 32], dropout=0.3):
        super(VulnerabilityNet, self).__init__()
        
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
        
        # Output layer (binary classification)
        layers.append(nn.Linear(prev_size, 1))
        layers.append(nn.Sigmoid())
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)


def train_neural_network(data_path=None, epochs=100, batch_size=32, learning_rate=0.001):
    """
    Train the neural network on the numeric features.
    """
    if data_path is None:
        data_path = Path(__file__).parent.parent / "CSV_master" / "numericFeatures.csv"
    
    print("--- Neural Network Training ---")
    
    # Load data
    df = pd.read_csv(data_path)
    X = df.drop(['LABEL', 'SOURCE'], axis=1).values
    y = df['LABEL'].values
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    
    # Scale features (important for neural networks)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Convert to PyTorch tensors
    X_train_tensor = torch.FloatTensor(X_train_scaled)
    y_train_tensor = torch.FloatTensor(y_train).unsqueeze(1)
    X_test_tensor = torch.FloatTensor(X_test_scaled)
    y_test_tensor = torch.FloatTensor(y_test).unsqueeze(1)
    
    # Create DataLoader
    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    
    # Initialize model with larger architecture
    input_size = X_train.shape[1]
    model = VulnerabilityNet(input_size, hidden_sizes=[512, 256, 128, 64], dropout=0.3)
    
    # Loss and optimizer
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)
    
    print(f"Training on {len(X_train)} samples, validating on {len(X_test)} samples")
    print(f"Input features: {input_size}")
    
    # Training loop
    best_accuracy = 0
    best_model_state = None
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        
        # Validation
        model.eval()
        with torch.no_grad():
            val_outputs = model(X_test_tensor)
            val_predictions = (val_outputs >= 0.5).float()
            accuracy = (val_predictions == y_test_tensor).float().mean().item()
            val_loss = criterion(val_outputs, y_test_tensor).item()
        
        scheduler.step(val_loss)
        
        # Save best model
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_model_state = model.state_dict().copy()
        
        if (epoch + 1) % 20 == 0:
            print(f"Epoch [{epoch+1}/{epochs}] - Loss: {total_loss/len(train_loader):.4f} - Val Accuracy: {accuracy:.2%}")
    
    # Load best model
    model.load_state_dict(best_model_state)
    
    # Final evaluation
    model.eval()
    with torch.no_grad():
        test_outputs = model(X_test_tensor)
        test_predictions = (test_outputs >= 0.5).float().numpy()
    
    print("\n--- Final Model Evaluation ---")
    print(confusion_matrix(y_test, test_predictions))
    print(classification_report(y_test, test_predictions))
    print(f"\nBest Validation Accuracy: {best_accuracy:.2%}")
    
    # Save model and scaler
    model_dir = Path(__file__).parent.parent / "ML_master"
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # Save PyTorch model - use the actual sizes used in training
    hidden_sizes_used = [512, 256, 128, 64]
    torch.save({
        'model_state_dict': model.state_dict(),
        'input_size': input_size,
        'hidden_sizes': hidden_sizes_used,
        'dropout': 0.3
    }, model_dir / 'acidModel_neural.pt')
    
    # Save scaler
    dump(scaler, model_dir / 'acidModel_scaler.pkl')
    
    print(f"\nNeural network saved to: {model_dir / 'acidModel_neural.pt'}")
    print(f"Scaler saved to: {model_dir / 'acidModel_scaler.pkl'}")
    
    return best_accuracy


if __name__ == "__main__":
    train_neural_network(epochs=300)
