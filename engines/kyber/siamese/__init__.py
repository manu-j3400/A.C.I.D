"""
Engine 2: Siamese GCN IR Equivalence Verifier
"""
from .network import SiameseGCN, GCNEncoder, ContrastiveLoss, IRVerificationResult
from .cfg_builder import ASTCFGBuilder, BytecodeCFGBuilder, ControlFlowGraph
from .contrastive import (
    GraphPair,
    GraphPairDataset,
    SiameseTrainer,
    TrainingConfig,
    verify_source_bytecode,
)

__all__ = [
    "SiameseGCN",
    "GCNEncoder",
    "ContrastiveLoss",
    "IRVerificationResult",
    "ASTCFGBuilder",
    "BytecodeCFGBuilder",
    "ControlFlowGraph",
    "GraphPair",
    "GraphPairDataset",
    "SiameseTrainer",
    "TrainingConfig",
    "verify_source_bytecode",
]
