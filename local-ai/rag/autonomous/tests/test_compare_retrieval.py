import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import compare_retrieval as c
import numpy as np


def unit(seed, dims=8):
    vector = np.random.default_rng(seed).normal(size=dims).astype(np.float32)
    return vector / np.linalg.norm(vector)


def row(document, page, chunk, text):
    return {"document_id": document, "page_number": page, "chunk_id": chunk, "text": text}


ROWS = [row("A_x", 1, "c1", "Educator expenses on line 11 for teachers."), row("B_x", 1, "c2", "General guidance about many deductions and credits for individuals."), row("C_x", 3, "c3", "The Medicare tax rate is 1.45% each for the employee and employer."),
        row("D_x", 1, "c4", "Publication 4557 explains safeguarding taxpayer data for your business."), row("E_x", 2, "c5", "Other text about records retention and filing dates.")]
TITLES = {"A_x": "Form 1040 Schedule 1", "B_x": "Instructions for Form 1040", "C_x": "Instructions for Form 941", "D_x": "Publication 4557", "E_x": "Form W-9"}
MATRIX = np.vstack([unit(i) for i in range(1, 6)])


class Hybrid(unittest.TestCase):
    def setUp(self):
        self.index = c.HybridIndex(ROWS, MATRIX, TITLES)

    def test_tokens_drop_stop_words_and_keep_tax_identifiers(self):
        self.assertEqual(c.tokens("What is the W-9 for 1.45%?"), ["w-9", "1.45"])

    def test_vector_only_ranks_by_similarity(self):
        self.assertEqual(self.index.vector_only(unit(3), 1)[0][0], 2)

    def test_keywords_rescue_what_embeddings_miss(self):
        wrong_vector = -MATRIX[2]
        embeddings_alone = [i for i, _ in self.index.vector_only(wrong_vector, 5)]
        with_keywords = [i for i, _ in self.index.hybrid("Medicare tax rate employee", wrong_vector, 5)]
        self.assertEqual(embeddings_alone[-1], 2)
        self.assertLess(with_keywords.index(2), embeddings_alone.index(2))

    def test_a_named_document_gets_the_bonus(self):
        self.assertEqual(self.index._named_documents("What does Publication 4557 say?"), {"D_x"})
        self.assertEqual(self.index._named_documents("Tell me about taxes"), set())
        self.assertEqual(self.index.hybrid("What does Publication 4557 say about anything?", unit(5), 1)[0][0], 3)

    def test_results_are_deterministic_and_bounded(self):
        one = self.index.hybrid("teachers expenses", unit(2), 3)
        self.assertEqual(one, self.index.hybrid("teachers expenses", unit(2), 3))
        self.assertEqual(len(one), 3)
        self.assertEqual(len({i for i, _ in one}), 3)


def scored(id, document_rank, passage_rank):
    return {"id": id, "source": "S", "document_rank": document_rank, "passage_rank": passage_rank}


def counts(passage_1=5, passage_5=10, document_5=12):
    return {"recall": {"cases": 21, "document": {"1": 0, "3": 0, "5": document_5}, "passage": {"1": passage_1, "3": 0, "5": passage_5}}}


def answered(**changes):
    return {"cited_the_passage_with_evidence": 8, "correctly_refused": 9, "invented_citations": 0, "evidence_missing_and_answered_anyway": 1, "reasoning_traces": 0, **changes}


class Comparison(unittest.TestCase):
    def test_recall_counts_at_one_three_and_five(self):
        out = c.recall_counts([scored("a", 1, None), scored("b", 2, 3), scored("c", None, None), scored("d", 5, 5)])
        self.assertEqual(out, {"cases": 4, "document": {"1": 1, "3": 2, "5": 3}, "passage": {"1": 0, "3": 1, "5": 2}})

    def test_paired_results_name_each_question_that_moved(self):
        out = c.paired_changes([scored("a", 1, 2), scored("b", 1, 1), scored("c", 2, None), scored("d", None, None)], [scored("a", 1, 1), scored("b", 3, None), scored("c", 2, None), scored("d", 2, 4)])
        self.assertEqual((out["passage_improved"], out["passage_regressed"], out["document_regressed"]), (["a", "d"], ["b"], ["b"]))
        self.assertEqual(out["questions"][1]["passage_rank"], [1, None])
        self.assertIn("Not evidence of statistical significance", out["note"])

    def test_sign_test_is_exact_and_refuses_an_empty_comparison(self):
        self.assertIsNone(c.sign_test(0, 0))
        self.assertEqual(c.sign_test(5, 0), 0.0625)
        self.assertEqual(c.sign_test(1, 1), 1.0)
        self.assertEqual(c.sign_test(0, 5), 0.0625)

    def decide(self, new=None, new_answers=None):
        return c.decide({"vector_only": counts(), "hybrid": new or counts(passage_5=12)}, {"vector_only": answered(), "hybrid": new_answers or answered()})

    def test_improvement_with_nothing_worse_is_confirmed(self):
        self.assertEqual(self.decide()["outcome"], "HELD_OUT_IMPROVEMENT_CONFIRMED")
        self.assertEqual(self.decide(counts(passage_1=6))["better"], ["1"])

    def test_no_improvement_keeps_the_baseline(self):
        self.assertEqual(self.decide(counts())["outcome"], "RETAIN_BASELINE")

    def test_any_safety_or_citation_loss_keeps_the_baseline_despite_better_retrieval(self):
        for name, change in (("citations_of_the_evidence_passage", {"cited_the_passage_with_evidence": 7}), ("refusals", {"correctly_refused": 8}), ("invented_citations", {"invented_citations": 1}),
                             ("answered_without_evidence", {"evidence_missing_and_answered_anyway": 2}), ("reasoning_traces", {"reasoning_traces": 1})):
            out = self.decide(new_answers=answered(**change))
            self.assertEqual((out["outcome"], out["worse"]), ("RETAIN_BASELINE", [name]))

    def test_losing_recall_at_five_keeps_the_baseline_even_if_rank_one_improves(self):
        self.assertEqual(self.decide(counts(passage_1=8, passage_5=9))["worse"], ["passage_recall_at_5"])
        self.assertEqual(self.decide(counts(passage_1=8, document_5=11))["worse"], ["document_recall_at_5"])

    def test_the_baseline_must_reproduce_the_first_evaluation(self):
        metrics = {"document_hit_at_1": 0.7, "document_hit_at_5": 0.9, "passage_hit_at_1": 0.467, "passage_hit_at_5": 0.767}
        first = {"retrieval": {"metrics": {"overall": dict(metrics)}}}
        self.assertTrue(c.matches_first_evaluation(metrics, first)["same"])
        self.assertFalse(c.matches_first_evaluation({**metrics, "passage_hit_at_5": 0.8}, first)["same"])

    def test_each_method_searches_with_its_own_ranking_and_records_latency(self):
        index = c.HybridIndex(ROWS, MATRIX, TITLES)
        case = {"id": "G", "domain": "D", "source": "C", "question": "Medicare tax rate employee", "evidence": "Medicare tax rate is 1.45%"}
        source_of = {r["document_id"]: r["document_id"][0] for r in ROWS}
        base = c.run_set([case], index, source_of, lambda q: -MATRIX[2], "vector_only")
        new = c.run_set([case], index, source_of, lambda q: -MATRIX[2], "hybrid")
        self.assertEqual(base["results"][0]["passage_rank"], 5)
        self.assertLess(new["results"][0]["passage_rank"], 5)
        self.assertEqual(new["search_latency"]["queries"], 1)
        self.assertIsNone(c.latency_summary([]))

    def test_answers_use_the_method_asked_for(self):
        index = c.HybridIndex(ROWS, MATRIX, TITLES)
        prompts = []
        def answerer(prompt):
            prompts.append(prompt)
            return "NOT_IN_SOURCES", "stop"
        case = {"id": "G", "question": "Medicare tax rate employee", "evidence": "Medicare tax rate is 1.45%"}
        for method, retrieved in (("vector_only", 1), ("hybrid", 1)):
            out = c.run_answers([case], [], index, lambda texts: [(-MATRIX[0]).tolist() for _ in texts], answerer, method)
            self.assertEqual(out["answerable"], retrieved)
        self.assertNotEqual(prompts[0], prompts[1])


class Refusals(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db = sqlite3.connect(Path(self.directory.name) / "p.sqlite3")
        self.db.execute("CREATE TABLE pages(cleaned_text TEXT, original_text TEXT)")
        self.db.execute("INSERT INTO pages VALUES('See Publication 17 for help.', 'x')")

    def tearDown(self):
        self.db.close()
        self.directory.cleanup()

    def test_an_item_whose_answer_is_present_is_rejected(self):
        valid, invalid = c.validate_refusals([{"id": "A", "absent_terms": ["ASC 606"]}, {"id": "B", "absent_terms": ["publication 17"]}], self.db)
        self.assertEqual([v["id"] for v in valid], ["A"])
        self.assertEqual(invalid[0]["id"], "B")


class Answers(unittest.TestCase):
    def setUp(self):
        self.index = c.HybridIndex(ROWS, MATRIX, TITLES)
        self.case = {"id": "G", "question": "Medicare tax rate employee", "evidence": "Medicare tax rate is 1.45%"}
        self.embed = lambda texts: [unit(3).tolist() for _ in texts]

    def answers(self, replies, cases=None, refusals=()):
        replies = iter(replies)
        return c.run_answers([self.case] if cases is None else cases, list(refusals), self.index, self.embed, lambda prompt: (next(replies), "stop"))

    def citation_of_evidence(self):
        passages = [(self.index.rows[i]["page_number"], self.index.rows[i]["text"]) for i, _ in self.index.hybrid(self.case["question"], unit(3), c.ANSWER_PASSAGES)]
        return next(n for n, (_, t) in enumerate(passages, start=1) if "Medicare" in t)

    def test_counts_a_correct_citation(self):
        out = self.answers([f"The rate is 1.45% [S{self.citation_of_evidence()}]."])
        self.assertEqual((out["evidence_was_retrieved"], out["cited_the_passage_with_evidence"]), (1, 1))

    def test_a_citation_of_the_wrong_passage_is_not_counted(self):
        wrong = 1 if self.citation_of_evidence() != 1 else 2
        self.assertEqual(self.answers([f"The rate is 1.45% [S{wrong}]."])["cited_the_passage_with_evidence"], 0)

    def test_answering_when_the_evidence_was_not_retrieved_is_counted_separately(self):
        missing = {**self.case, "evidence": "text that is nowhere"}
        self.assertEqual(self.answers(["It is 5% [S1]."], [missing])["evidence_missing_and_answered_anyway"], 1)
        self.assertEqual(self.answers(["NOT_IN_SOURCES"], [missing])["evidence_missing_and_declined"], 1)

    def test_refusal_needs_a_decline_without_citing(self):
        item = {"id": "R", "question": "Estate tax exemption?"}
        self.assertEqual(self.answers(["NOT_IN_SOURCES"], [], [item])["correctly_refused"], 1)
        self.assertEqual(self.answers(["It is $13 million [S1]."], [], [item])["correctly_refused"], 0)

    def test_invented_citations_and_traces_are_counted(self):
        out = self.answers(["<think>x</think>Yes [S9]."])
        self.assertEqual((out["invented_citations"], out["reasoning_traces"]), (1, 1))

    def test_the_limit_is_stated(self):
        self.assertIn("None of this establishes", self.answers(["NOT_IN_SOURCES"])["limit"])


class HeldOutSet(unittest.TestCase):
    DATA = json.loads((Path(c.__file__).resolve().parents[1] / "config/retrieval_heldout_set.json").read_text(encoding="utf-8"))

    def test_well_formed_and_honest_about_what_it_is(self):
        self.assertIn("not a tax professional", self.DATA["note"])
        ids = [x["id"] for x in self.DATA["cases"] + self.DATA["refusal"]]
        self.assertEqual(len(ids), len(set(ids)))
        for case in self.DATA["cases"]:
            self.assertTrue(case["question"] and case["source"] and case["evidence"])
        for item in self.DATA["refusal"]:
            self.assertTrue(item["question"] and item["absent_terms"])

    def test_questions_do_not_repeat_their_evidence_wording(self):
        for case in self.DATA["cases"]:
            self.assertNotIn(case["evidence"].lower(), case["question"].lower(), case["id"])

    def test_no_overlap_with_the_seen_set(self):
        seen = json.loads((Path(c.__file__).resolve().parents[1] / "config/retrieval_evaluation_set.json").read_text(encoding="utf-8"))
        self.assertFalse({q["question"] for q in seen["cases"]} & {q["question"] for q in self.DATA["cases"]})
        self.assertFalse({q["evidence"] for q in seen["cases"]} & {q["evidence"] for q in self.DATA["cases"]})


if __name__ == "__main__":
    unittest.main()
