from dataPipeline_AST import hardened_Dataset_with_Normalization
from extractor_AST import get_Node_Counts
from trainerModel_AST import modelTrainer

if __name__ == "__main__":
    hardened_Dataset_with_Normalization()
    get_Node_Counts()
    modelTrainer()

