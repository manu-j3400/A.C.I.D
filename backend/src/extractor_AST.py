import pandas as pd
import ast
from collections import Counter
from pathlib import Path

def get_Node_Counts(sourceCode=""):
    """
    Counts the occurrences of each AST node type in the code.
    """

    try:
        tree = ast.parse(sourceCode)
        nodeCount = [type(node).__name__ for node in ast.walk(tree)]  # Walk the tree and collect the name of every node type (eg., Call, Import, Assign)
        return dict(Counter(nodeCount))

    except Exception as e:
        return e
    

# Load csv
inputPath = Path(Path(__file__).parent.parent / "CSV_master" / "finalData.csv")
df = pd.read_csv(inputPath)

# creates of a list of dictionaries like {Assign: 2, Call: 2, Return: 1}
featuresList = df["normalizedCode"].apply(get_Node_Counts).tolist()

# creating the dataframe and fills the empty values with 0 (eg., if one func. has an Import and another doesn't, the other function gets a Import: 0)
featuresDf = pd.DataFrame(featuresList).fillna(0)

# attaching the Labels and Source for training (for the AI Model)
featuresDf['LABEL'] = df['label']
featuresDf['SOURCE'] = df['source']


# the AI-Ready numeric matrix
outputPath = inputPath.parent / "numericFeatures.csv"
featuresDf.to_csv(outputPath, index=False)

print(f"Success! Numeric matrix created with {len(featuresDf)} samples.")
print(featuresDf.head())




