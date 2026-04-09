"""
symbolic_layer — Fuzzy logic layer bridging neural scores to MITRE rules.

Implements multiple t-norms and a NeurosymbolicBridge that evaluates
the RuleBase using soft-logic operations rather than hard thresholds.
This makes the full pipeline end-to-end differentiable (for training)
and interpretable (for analysts).

References
----------
Hájek, P. (1998). Metamathematics of Fuzzy Logic. Springer.
Badreddine et al. (2022). Logic Tensor Networks. AIJ.
"""

from __future__ import annotations

import enum
import math
from typing import Dict, List, Optional, Tuple

from .mitre_rules import MITRETactic, RuleBase


class TNorm(enum.Enum):
    """Fuzzy t-norm selection."""
    PRODUCT     = "product"     # p(a,b) = a·b  (differentiable, strict)
    LUKASIEWICZ = "lukasiewicz" # L(a,b) = max(0, a+b-1)  (boundary-sensitive)
    GODEL       = "godel"       # G(a,b) = min(a,b)  (weakest)


class FuzzyLogicLayer:
    """
    Stateless fuzzy logic operations parameterised by a t-norm.

    All inputs/outputs are floats in [0, 1].
    """

    def __init__(self, t_norm: TNorm = TNorm.PRODUCT) -> None:
        self.t_norm = t_norm

    # ------------------------------------------------------------------
    # Core fuzzy connectives
    # ------------------------------------------------------------------

    def conjunction(self, scores: List[float]) -> float:
        """Fuzzy AND over a list of scores."""
        if not scores:
            return 1.0  # vacuously true
        result = float(scores[0])
        for s in scores[1:]:
            result = self._tnorm(result, float(s))
        return result

    def disjunction(self, scores: List[float]) -> float:
        """Fuzzy OR via De Morgan's law: NOT(AND(NOT(scores)))."""
        if not scores:
            return 0.0
        return self.negation(self.conjunction([self.negation(s) for s in scores]))

    def negation(self, score: float) -> float:
        """Standard fuzzy negation: 1 - x."""
        return max(0.0, min(1.0, 1.0 - score))

    def implication(self, antecedent: float, consequent: float) -> float:
        """
        Residuated implication (Łukasiewicz): min(1, 1 - a + b).
        Holds for all three t-norms as a consistent choice.
        """
        return min(1.0, 1.0 - antecedent + consequent)

    def _tnorm(self, a: float, b: float) -> float:
        a = max(0.0, min(1.0, a))
        b = max(0.0, min(1.0, b))
        if self.t_norm == TNorm.PRODUCT:
            return a * b
        elif self.t_norm == TNorm.LUKASIEWICZ:
            return max(0.0, a + b - 1.0)
        else:  # GODEL
            return min(a, b)

    # ------------------------------------------------------------------
    # Rule evaluation helper
    # ------------------------------------------------------------------

    def evaluate_rule(
        self,
        required_scores: List[float],
        optional_scores: List[float] = [],
        weight: float = 1.0,
    ) -> float:
        """
        Soft rule confidence:
          confidence = weight × conjunction(required) × disjunction(optional ∪ {1})
        """
        req_conf = self.conjunction(required_scores)
        if optional_scores:
            opt_conf = self.disjunction(optional_scores)
            return weight * self._tnorm(req_conf, opt_conf)
        return weight * req_conf


class NeurosymbolicBridge:
    """
    Combines a RuleBase with a FuzzyLogicLayer to score MITRE rules against
    neural technique scores and produce an aggregated APT chain probability.

    Parameters
    ----------
    rule_base    : RuleBase (default: default 12-rule set)
    fuzzy_layer  : FuzzyLogicLayer (default: product t-norm)
    """

    def __init__(
        self,
        rule_base:   Optional[RuleBase]          = None,
        fuzzy_layer: Optional[FuzzyLogicLayer]   = None,
    ) -> None:
        self._rb  = rule_base   or RuleBase()
        self._fl  = fuzzy_layer or FuzzyLogicLayer(TNorm.PRODUCT)

    # ------------------------------------------------------------------
    # Forward pass
    # ------------------------------------------------------------------

    def forward(
        self,
        technique_scores: Dict[str, float],
    ) -> Dict[str, float]:
        """
        Evaluate all rules in the base and return rule_id → confidence.

        Uses the fuzzy layer's conjunction so the product t-norm aggregation
        is consistent with the configured norm.
        """
        results: Dict[str, float] = {}
        for rule in self._rb._rules:
            scores = [
                float(technique_scores.get(tid, 0.0))
                for tid in rule.required_techniques
            ]
            results[rule.rule_id] = self._fl.evaluate_rule(scores)
        return results

    def apt_chain_score(
        self,
        technique_scores: Dict[str, float],
    ) -> float:
        """
        Aggregated multi-stage APT probability.

        Computed as the mean of the per-tactic max technique score, then
        passed through the conjunction over the top-4 tactics to ensure
        the score is high only when multiple attack phases are active.
        """
        coverage = self._rb.tactic_coverage(technique_scores)
        sorted_scores = sorted(coverage.values(), reverse=True)
        top4 = sorted_scores[:4]
        if not top4:
            return 0.0
        # Weighted combination: strict AND of top-4 phases
        chain = self._fl.conjunction(top4)
        return float(chain)

    def explain(
        self,
        technique_scores: Dict[str, float],
        rule_id: str,
    ) -> Dict:
        """
        Return an explanation dict for a specific rule:
          - per-technique score that drove the result
          - overall confidence
          - which techniques are above/below soft threshold
        """
        rule = self._rb.get_rule(rule_id)
        if rule is None:
            return {"error": f"Rule {rule_id} not found"}

        breakdown: Dict[str, Dict] = {}
        for tid in rule.required_techniques:
            score = float(technique_scores.get(tid, 0.0))
            breakdown[tid] = {
                "score":    round(score, 4),
                "above_threshold": score >= rule.soft_threshold,
            }

        required = [float(technique_scores.get(tid, 0.0)) for tid in rule.required_techniques]
        confidence = self._fl.evaluate_rule(required)

        return {
            "rule_id":         rule.rule_id,
            "rule_name":       rule.name,
            "confidence":      round(confidence, 4),
            "soft_threshold":  rule.soft_threshold,
            "fired":           confidence >= rule.soft_threshold,
            "technique_breakdown": breakdown,
        }

    def top_k_detections(
        self,
        technique_scores: Dict[str, float],
        k: int = 5,
    ) -> List[Tuple[str, float]]:
        """Return top-k (rule_id, confidence) sorted by confidence descending."""
        scores = self.forward(technique_scores)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)[:k]
