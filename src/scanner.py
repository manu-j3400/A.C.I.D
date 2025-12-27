import joblib
import pandas as pd
import ast
from collections import Counter

picklePath = '/Users/manujawahar/workspace/ACID/ML_master/acidModel.pkl'

model = joblib.load(picklePath)

def codeScanner(new_Source):
    tree = ast.parse(new_Source)
    nodes = [type(node).__name__ for node in ast.walk(tree)]
    counts = dict(Counter(nodes))


    df_test = pd.DataFrame([counts]).fillna(0)



    return model.predict(df_test)

