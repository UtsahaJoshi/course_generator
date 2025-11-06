# main.py

import os
import json
import re
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI

# ---------------- Init & config ----------------
load_dotenv()  # expects a .env with OPENAI_API_KEY=sk-xxxx
app = Flask(__name__, static_folder="static")
CORS(app)

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Fast, instruction-following text model
MODEL_FAST = "gpt-4o-mini"

# ---------------- Utilities ----------------

def count_words_from_course_json(course_obj):
    """Count words across all section paragraphs."""
    if not isinstance(course_obj, dict) or "sections" not in course_obj:
        return 0
    total_text = []
    for sec in course_obj.get("sections", []):
        for p in sec.get("paragraphs", []):
            if isinstance(p, str):
                total_text.append(p)
    return len(re.findall(r"\b\w+\b", " ".join(total_text)))

def paragraph_word_counts(course_obj):
    """Return [((section_index, paragraph_index), word_count), ...]."""
    counts = []
    for si, sec in enumerate(course_obj.get("sections", [])):
        for pi, p in enumerate(sec.get("paragraphs", [])):
            if isinstance(p, str):
                wc = len(re.findall(r"\b\w+\b", p))
                counts.append(((si, pi), wc))
    return counts

# ---------------- Prompts ----------------

QC_CLASSIFIER_SYSTEM = (
    "You are a strict classifier. Decide if the user's prompt is about Quantum Computing (QC). "
    "Reply with a strict JSON object only, no prose, with:\n"
    '{ "is_qc": true|false }\n'
    "Consider as QC: topics like qubits, superposition, entanglement, quantum gates, "
    "quantum algorithms (Shor, Grover), quantum error correction, quantum hardware, etc."
)

QC_SYSTEM_PROMPT = (
    "You are a course content generator that ONLY creates content about Quantum Computing (QC).\n"
    "Respond with ONLY a STRICT JSON object (no prose before/after, no code fences) with keys:\n"
    "  - course_title: string\n"
    "  - sections: array of objects with keys {heading: string, paragraphs: array of strings}\n"
    "  - choices: array of EXACTLY two objects, each {key: '1' or '2', text: string}\n\n"
    "Hard length & structure constraints (MANDATORY):\n"
    "  - Target total length ≈ 900–1200 words across all paragraphs (about 2 pages). "
    "    ABSOLUTE MINIMUM: 900 words.\n"
    "  - Use 6–9 sections.\n"
    "  - Each section must have 3 paragraphs.\n"
    "  - Each paragraph should be cohesive prose (no lists), roughly 100–140 words.\n"
    "  - choices:\n"
    "      * key '1' text = a topic closely related to the current QC topic\n"
    "      * key '2' text = a topic in a different direction from choice 1\n\n"
    "Formatting rules:\n"
    "- Output ONLY the JSON object.\n"
    "- No markdown, no explanations, no extra keys."
)

EXPAND_SYSTEM_PROMPT_TEMPLATE = (
    "You are revising an existing QC course JSON to meet length constraints. "
    "Return ONLY a STRICT JSON object with the SAME keys (course_title, sections, choices). "
    "Do not add any new keys. Keep the factual content, but expand the prose so that total length "
    "is around {target_words} words (must be within 900–1200). Maintain 6–9 sections, "
    "each with 3 paragraphs. Ensure paragraphs are cohesive prose (no lists) and ~100–140 words each. "
    "No markdown, no explanations."
)

EXPAND_SHORT_PARAS_INSTRUCTION = (
    "Some paragraphs are too short. Please expand them while keeping meaning intact. "
    "Ensure overall length is within 900–1200 words and individual paragraphs ~100–140 words."
)

# ---------------- Model calls ----------------

def classify_is_qc(user_text: str) -> bool:
    """
    Use a fast JSON-mode classification to decide if the prompt is QC-related.
    Returns True if QC, else False.
    """
    resp = client.chat.completions.create(
        model=MODEL_FAST,
        messages=[
            {"role": "system", "content": QC_CLASSIFIER_SYSTEM},
            {"role": "user", "content": user_text},
        ],
        temperature=0.0,
        max_tokens=100,
        response_format={"type": "json_object"},
    )
    try:
        data = json.loads(resp.choices[0].message.content)
        return bool(data.get("is_qc", False))
    except Exception:
        # If anything goes wrong, be conservative and say not QC.
        return False

def call_course_model(user_text, system_prompt):
    return client.chat.completions.create(
        model=MODEL_FAST,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        temperature=0.3,
        max_tokens=3400,
        response_format={"type": "json_object"},
    )

def call_expand_model(existing_json_str, target_words=1100):
    return client.chat.completions.create(
        model=MODEL_FAST,
        messages=[
            {
                "role": "system",
                "content": EXPAND_SYSTEM_PROMPT_TEMPLATE.format(target_words=target_words),
            },
            {
                "role": "user",
                "content": (
                    "Here is the current JSON. Expand/adjust to meet the constraints. "
                    "Return ONLY the JSON, no extra text:\n\n" + existing_json_str
                ),
            },
        ],
        temperature=0.25,
        max_tokens=3600,
        response_format={"type": "json_object"},
    )

def call_expand_short_paragraphs(existing_json_str, short_positions, target_words=1100):
    """Ask model to specifically expand short paragraphs identified by positions."""
    positions_text = ", ".join([f"(section {si+1}, paragraph {pi+1})" for (si, pi) in short_positions])
    return client.chat.completions.create(
        model=MODEL_FAST,
        messages=[
            {
                "role": "system",
                "content": EXPAND_SYSTEM_PROMPT_TEMPLATE.format(target_words=target_words),
            },
            {
                "role": "user",
                "content": (
                    f"{EXPAND_SHORT_PARAS_INSTRUCTION}\n"
                    f"Short paragraphs to expand (1-indexed): {positions_text or 'none'}.\n\n"
                    "Return ONLY the JSON, no extra text:\n\n" + existing_json_str
                ),
            },
        ],
        temperature=0.25,
        max_tokens=3600,
        response_format={"type": "json_object"},
    )

# ---------------- Route ----------------

@app.route('/generate-course', methods=['POST'])
def generate_course():
    """
    Expects: { "text": "<user prompt>" }
    Returns: { "content": "<string>" }
      - If valid: content is a JSON string your frontend can JSON.parse
      - If invalid (not QC): content is the exact string "Not Valid Content"
    """
    text = (request.json.get('text') or '').strip()

    # Quick pre-check: if not clearly QC-related, short-circuit.
    is_qc = classify_is_qc(text)
    if not is_qc:
        return jsonify({"content": "Not Valid Content"})

    try:
        # 1) First attempt to generate course JSON
        resp = call_course_model(text, QC_SYSTEM_PROMPT)
        content = resp.choices[0].message.content.strip()

        # Parse JSON
        try:
            course_obj = json.loads(content)
        except Exception:
            # Shouldn't happen with JSON mode, but safeguard:
            return jsonify({"content": "Not Valid Content"})

        # 2) Validate length; iteratively expand if short (up to 2 retries)
        MAX_RETRIES = 2
        TARGET_WORDS = 1100

        for attempt in range(MAX_RETRIES + 1):  # initial + retries
            wc = count_words_from_course_json(course_obj)
            if wc >= 900:
                # good enough
                return jsonify({"content": json.dumps(course_obj, ensure_ascii=False)})

            # Try to expand short paragraphs first (more controlled), else general expand
            short_positions = [
                pos for (pos, pwc) in paragraph_word_counts(course_obj) if pwc < 100
            ]
            json_str = json.dumps(course_obj, ensure_ascii=False)

            if short_positions:
                expand_resp = call_expand_short_paragraphs(json_str, short_positions, target_words=TARGET_WORDS)
            else:
                expand_resp = call_expand_model(json_str, target_words=TARGET_WORDS)

            new_content = expand_resp.choices[0].message.content.strip()
            try:
                course_obj = json.loads(new_content)
            except Exception:
                # If malformed for some reason, stop and return best-so-far
                break

        # After retries, return best we have (even if short)
        return jsonify({"content": json.dumps(course_obj, ensure_ascii=False)})

    except Exception as e:
        # Fallback (do not break the contract)
        return jsonify({"content": "Not Valid Content", "error": str(e)}), 200


if __name__ == '__main__':
    app.run(debug=True)
