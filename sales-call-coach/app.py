import html
import io
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

import altair as alt
import pandas as pd
import streamlit as st
from dotenv import dotenv_values, load_dotenv
from openai import OpenAI, OpenAIError


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH, override=True)

APP_TITLE = "מאמן שיחות מכירה"
SCRIPT_PATH = BASE_DIR / "sales_script.txt"
ANALYSIS_SKILL_PATH = BASE_DIR / "sales_analysis_skill.txt"
REPORTS_DIR = BASE_DIR / "reports"
INSIGHTS_PATH = REPORTS_DIR / "insights.json"
TRANSCRIPTION_MODEL = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")
TRANSCRIPTION_FALLBACK_MODEL = "whisper-1"
ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-5.4-mini")
ANALYSIS_MODEL_OPTIONS = [
    "gpt-5.4-mini",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-4.1-mini",
]
MAX_OPENAI_AUDIO_BYTES = 24 * 1024 * 1024
COMPRESSION_BITRATES = ["32000", "24000", "16000"]
SUPPORTED_AUDIO_EXTENSIONS = {
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".oga",
    ".ogg",
    ".wav",
    ".webm",
}
SUPPORTED_UPLOAD_EXTENSIONS = ["mp3", "m4a", "wav", "mp4", "mpeg", "mpga", "oga", "ogg", "webm", "flac"]
AUDIO_MIME_TO_EXTENSION = {
    "audio/aac": ".m4a",
    "audio/flac": ".flac",
    "audio/m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "video/mp4": ".mp4",
}
REPORT_SECTION_TITLES = [
    "הכשל המרכזי",
    "למה העסקה לא נסגרה",
    "ציטוטים קריטיים מהשיחה",
    "מה איש המכירות עשה במקום",
    "המשפט שבו העסקה התחילה ליפול",
    "איך היה נכון להגיב",
    "סיכום חד",
    "פרטי השיחה",
]


def setup_page() -> None:
    st.set_page_config(page_title=APP_TITLE, page_icon="🎧", layout="wide")
    st.markdown(
        """
        <style>
        html, body, [class*="css"] {
            direction: rtl;
            text-align: right;
        }
        .stTextInput input, .stTextArea textarea {
            direction: rtl;
            text-align: right;
        }
        .report-hero {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 22px 24px;
            background: #ffffff;
            margin: 12px 0 18px;
        }
        .report-eyebrow {
            color: #64748b;
            font-size: 0.9rem;
            margin-bottom: 6px;
        }
        .report-title {
            font-size: 1.8rem;
            font-weight: 750;
            color: #111827;
            margin-bottom: 4px;
        }
        .report-subtitle {
            color: #475569;
            font-size: 1rem;
        }
        .report-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px 18px;
            background: #ffffff;
            height: 100%;
        }
        .report-card-label {
            color: #64748b;
            font-size: 0.85rem;
            margin-bottom: 4px;
        }
        .report-card-value {
            color: #111827;
            font-size: 1.35rem;
            font-weight: 700;
        }
        .score-good { color: #047857; }
        .score-mid { color: #b45309; }
        .score-low { color: #dc2626; }
        .insight-card {
            border-radius: 8px;
            padding: 16px 18px;
            margin: 10px 0;
            border: 1px solid #e5e7eb;
            background: #ffffff;
        }
        .insight-card-good {
            border-color: #bbf7d0;
            background: #f0fdf4;
            color: #14532d;
            font-weight: 750;
        }
        .insight-card-bad {
            border-color: #fecaca;
            background: #fef2f2;
            color: #7f1d1d;
            font-weight: 750;
        }
        .history-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            background: #ffffff;
            margin-bottom: 10px;
        }
        .history-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: #111827;
        }
        .history-meta {
            color: #64748b;
            font-size: 0.9rem;
            margin-top: 2px;
        }
        .learning-card {
            border: 1px solid #dbeafe;
            border-right: 5px solid #2563eb;
            border-radius: 8px;
            padding: 14px 16px;
            background: #eff6ff;
            margin-bottom: 12px;
        }
        .learning-title {
            font-size: 1rem;
            font-weight: 750;
            color: #1e3a8a;
            margin-bottom: 6px;
        }
        .learning-meta {
            color: #475569;
            font-size: 0.85rem;
            margin-top: 8px;
        }
        .transcript-turn {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
            margin-bottom: 10px;
        }
        .transcript-speaker {
            color: #2563eb;
            font-weight: 750;
            margin-bottom: 4px;
        }
        .transcript-text {
            color: #111827;
            line-height: 1.7;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.title(APP_TITLE)
    st.caption("תמלול וניתוח שיחות מכירה בעברית לפי תסריט מכירה קבוע")


def get_configured_api_key() -> str:
    env_values = dotenv_values(ENV_PATH)
    api_key = env_values.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    return api_key.strip()


def get_openai_client(api_key: str) -> OpenAI:
    if not api_key:
        raise ValueError("לא נמצא OPENAI_API_KEY. יש להגדיר אותו בקובץ .env.")
    return OpenAI(api_key=api_key)


def read_sales_script() -> str:
    if not SCRIPT_PATH.exists():
        raise FileNotFoundError("הקובץ sales_script.txt לא נמצא בתיקיית הפרויקט.")

    script = SCRIPT_PATH.read_text(encoding="utf-8").strip()
    if not script:
        raise ValueError("הקובץ sales_script.txt ריק. יש להוסיף אליו את תסריט המכירה.")

    return script


def read_analysis_skill() -> str:
    if not ANALYSIS_SKILL_PATH.exists():
        raise FileNotFoundError("הקובץ sales_analysis_skill.txt לא נמצא בתיקיית הפרויקט.")

    skill = ANALYSIS_SKILL_PATH.read_text(encoding="utf-8").strip()
    if not skill:
        raise ValueError("הקובץ sales_analysis_skill.txt ריק. יש להוסיף אליו את שיטת הניתוח.")

    return skill


def get_audio_extension(uploaded_file) -> str:
    suffix = Path(uploaded_file.name).suffix.lower()
    if suffix in SUPPORTED_AUDIO_EXTENSIONS:
        return suffix

    content_type = (getattr(uploaded_file, "type", "") or "").lower()
    if content_type in AUDIO_MIME_TO_EXTENSION:
        return AUDIO_MIME_TO_EXTENSION[content_type]

    lower_name = uploaded_file.name.lower()
    for extension in SUPPORTED_AUDIO_EXTENSIONS:
        if extension in lower_name:
            return extension

    return ".m4a"


def build_openai_audio_file(uploaded_file) -> io.BytesIO:
    audio_file = io.BytesIO(uploaded_file.getvalue())
    audio_file.name = f"uploaded_audio{get_audio_extension(uploaded_file)}"
    return audio_file


def get_uploaded_file_size(uploaded_file) -> int:
    size = getattr(uploaded_file, "size", None)
    if isinstance(size, int):
        return size
    return len(uploaded_file.getvalue())


def transcribe_openai_audio_file(client: OpenAI, audio_file: io.BytesIO, model: str) -> str:
    result = client.audio.transcriptions.create(
        model=model,
        file=audio_file,
        language="he",
        response_format="text",
    )

    transcript = result if isinstance(result, str) else getattr(result, "text", "")
    transcript = transcript.strip()
    if not transcript:
        raise ValueError("התקבל תמלול ריק מ-OpenAI.")

    return transcript


def transcribe_audio_file_with_model(client: OpenAI, audio_file: io.BytesIO, model: str) -> str:
    if audio_file.getbuffer().nbytes > MAX_OPENAI_AUDIO_BYTES:
        raise ValueError(
            "קובץ האודיו עדיין גדול מדי גם אחרי דחיסה. "
            "צריך לפצל את השיחה לשני קבצים קצרים יותר ולנתח כל חלק בנפרד."
        )
    return transcribe_openai_audio_file(client, audio_file, model)


def transcribe_audio_with_model(client: OpenAI, uploaded_file, model: str) -> str:
    if get_uploaded_file_size(uploaded_file) > MAX_OPENAI_AUDIO_BYTES:
        audio_file = compress_uploaded_audio_to_m4a(uploaded_file)
    else:
        audio_file = build_openai_audio_file(uploaded_file)
    return transcribe_audio_file_with_model(client, audio_file, model)


def convert_uploaded_audio_to_m4a(uploaded_file, bitrate: str = "32000") -> io.BytesIO:
    input_suffix = get_audio_extension(uploaded_file)
    input_path = None
    output_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=input_suffix) as input_file:
            input_file.write(uploaded_file.getvalue())
            input_path = Path(input_file.name)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as output_file:
            output_path = Path(output_file.name)

        command = [
            "afconvert",
            "-f",
            "m4af",
            "-d",
            "aac",
            "-b",
            bitrate,
            "-c",
            "1",
            str(input_path),
            str(output_path),
        ]
        result = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
        if result.returncode != 0:
            raise ValueError(
                "לא הצלחתי להמיר את קובץ האודיו ל-m4a תקין. "
                "נסה לייצא את ההקלטה מחדש כ-m4a או mp3."
            )

        converted_audio = io.BytesIO(output_path.read_bytes())
        converted_audio.name = "converted_audio.m4a"
        return converted_audio
    finally:
        for path in (input_path, output_path):
            if path and path.exists():
                path.unlink()


def compress_uploaded_audio_to_m4a(uploaded_file) -> io.BytesIO:
    last_audio = None
    for bitrate in COMPRESSION_BITRATES:
        converted_audio = convert_uploaded_audio_to_m4a(uploaded_file, bitrate=bitrate)
        last_audio = converted_audio
        if converted_audio.getbuffer().nbytes <= MAX_OPENAI_AUDIO_BYTES:
            return converted_audio

    if last_audio is not None:
        return last_audio

    raise ValueError("לא הצלחתי לדחוס את קובץ האודיו.")


def transcribe_converted_audio(client: OpenAI, uploaded_file, model: str) -> str:
    converted_audio = compress_uploaded_audio_to_m4a(uploaded_file)
    return transcribe_audio_file_with_model(client, converted_audio, model)


def transcribe_audio(client: OpenAI, uploaded_file) -> str:
    try:
        return transcribe_audio_with_model(client, uploaded_file, TRANSCRIPTION_MODEL)
    except OpenAIError as exc:
        error_text = str(exc)
        should_retry_with_conversion = (
            "Invalid file format" in error_text
            or "Maximum content size limit" in error_text
            or "413" in error_text
        )
        if should_retry_with_conversion:
            return transcribe_converted_audio(client, uploaded_file, TRANSCRIPTION_FALLBACK_MODEL)

        should_retry_with_fallback = (
            TRANSCRIPTION_MODEL != TRANSCRIPTION_FALLBACK_MODEL
            and ("input_too_large" in error_text or "audio is too large" in error_text)
        )
        if not should_retry_with_fallback:
            raise

        return transcribe_audio_with_model(client, uploaded_file, TRANSCRIPTION_FALLBACK_MODEL)


def format_transcript_by_speaker(
    client: OpenAI,
    raw_transcript: str,
    salesperson_name: str,
    customer_name: str,
    model: str,
) -> str:
    customer_label = customer_name.strip() or "לא הוזן - יש להסיק מהשיחה אם אפשר"
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": (
                    "אתה עורך תמלול שיחות מכירה בעברית. "
                    "המטרה שלך היא לסדר תמלול קיים לפי דוברים, בלי לסכם ובלי להמציא תוכן."
                ),
            },
            {
                "role": "user",
                "content": f"""
סדר את התמלול הבא לפי דוברים.

שם איש/אשת המכירות: {salesperson_name}
שם הלקוח/ה: {customer_label}

כללי פלט:
- החזר Markdown בלבד.
- כל תור דיבור יהיה בפורמט:
  **שם הדובר/ת:** הטקסט שנאמר
- השאר שורה ריקה בין תור לתור.
- השתמש בשם איש/אשת המכירות: {salesperson_name}.
- אם שם הלקוח הוזן, השתמש בו. אם לא הוזן, נסה להסיק את שם הלקוח מתוך התמלול ולהשתמש בשם שזוהה. אם לא זוהה שם, השתמש ב"הלקוח/ה".
- אם לא ברור מי דיבר, בחר את הדובר/ת הסביר/ה לפי ההקשר.
- אל תשנה משמעות, אל תוסיף מידע, אל תקצר ואל תסכם.
- תקן רק פיסוק קל וחלוקה לשורות כדי שיהיה קריא.

תמלול גולמי:
{raw_transcript}
""".strip(),
            },
        ],
    )

    formatted_transcript = getattr(response, "output_text", "").strip()
    if not formatted_transcript:
        raise ValueError("התקבל תמלול לפי דוברים ריק מ-OpenAI.")

    return formatted_transcript


def build_analysis_prompt(
    sales_script: str,
    analysis_skill: str,
    transcript: str,
    salesperson_name: str,
    customer_name: str,
) -> str:
    customer_line = customer_name if customer_name else "לא הוזן - יש להסיק מהשיחה אם אפשר"
    return f"""
השתמש בסקיל הניתוח הבא כמתודת הניתוח היחידה.
שכח כל מבנה דוח אחר.

סקיל ניתוח:
{analysis_skill}

שם איש/אשת המכירות שהוזן באפליקציה: {salesperson_name}
שם הלקוח שהוזן באפליקציה: {customer_line}

תסריט המכירה:
{sales_script}

תמלול השיחה:
{transcript}

החזר דוח בעברית בפורמט Markdown בלבד, עם הכותרות הבאות בדיוק:

# דוח ניתוח שיחת מכירה

## הכשל המרכזי
## למה העסקה לא נסגרה
## ציטוטים קריטיים מהשיחה
## מה איש המכירות עשה במקום
## המשפט שבו העסקה התחילה ליפול
## איך היה נכון להגיב
## סיכום חד
## פרטי השיחה

הנחיות נוספות:
- אל תוסיף כותרות אחרות.
- אל תכתוב דוח כללי של חוזקות וחולשות.
- אם אין מספיק מידע, כתוב שחסר מידע ומה היה צריך לשאול.
- ב"פרטי השיחה" כתוב:
  - שם איש/אשת המכירות: {salesperson_name}
  - שם הלקוח: אם הוזן שם לקוח, השתמש בו. אם לא הוזן, הסק את שם הלקוח מתוך התמלול. אם אי אפשר להסיק, כתוב "לא זוהה מהשיחה".
""".strip()


def analyze_call(
    client: OpenAI,
    sales_script: str,
    analysis_skill: str,
    transcript: str,
    salesperson_name: str,
    customer_name: str,
    model: str,
) -> str:
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": (
                    "אתה מאמן מכירות בכיר. אתה מנתח שיחות מכירה בעברית "
                    "ומחזיר משוב פרקטי, ענייני ומובנה בלבד."
                ),
            },
            {
                "role": "user",
                "content": build_analysis_prompt(
                    sales_script=sales_script,
                    analysis_skill=analysis_skill,
                    transcript=transcript,
                    salesperson_name=salesperson_name,
                    customer_name=customer_name,
                ),
            },
        ],
    )

    report = getattr(response, "output_text", "").strip()
    if not report:
        raise ValueError("התקבל דוח ריק מ-OpenAI.")

    return report


def build_insights_prompt(report: str, transcript: str) -> str:
    return f"""
מתוך דוח ניתוח שיחת המכירה והתמלול, חלץ 1-3 תובנות קריטיות שכל איש מכירות בעסק יכול ללמוד מהן.

קהל היעד של העסק:
מטפלים, מאמנים, מנחים ויועצים שיש להם פגישות אחד על אחד, לפעמים עשו סדנה או הרצאה, לפעמים עשו קורס פרונטלי, ורוצים לפרוץ את מחסום "זמן שווה כסף", להרוויח גם כשהם לא עובדים, להגשים את עצמם, להשפיע על אנשים ולהפיץ את הבשורה שלהם לכמה שיותר אנשים.

כללי פלט:
- החזר JSON בלבד.
- המבנה חייב להיות: {{"insights": ["תובנה 1", "תובנה 2"]}}
- כל תובנה צריכה להיות משפט אחד עד שניים.
- כתוב חד, ברור ופרקטי.
- אל תחזור על סיכום השיחה.
- אל תכתוב תובנות כלליות כמו "חשוב להקשיב ללקוח".
- התובנה חייבת להיות משהו שאפשר ליישם בשיחת המכירה הבאה.
- אל תמציא פרטים שלא מופיעים בדוח או בתמלול.

דוח:
{report}

תמלול:
{transcript}
""".strip()


def parse_insights_json(response_text: str) -> list[str]:
    response_text = response_text.strip()
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        json_match = re.search(r"\{.*\}", response_text, flags=re.DOTALL)
        if not json_match:
            return []
        try:
            data = json.loads(json_match.group(0))
        except json.JSONDecodeError:
            return []

    insights = data.get("insights", [])
    if not isinstance(insights, list):
        return []

    cleaned_insights = []
    for insight in insights:
        if isinstance(insight, str):
            clean_insight = clean_markdown_value(insight)
            if clean_insight:
                cleaned_insights.append(clean_insight)

    return cleaned_insights[:3]


def generate_call_insights(client: OpenAI, report: str, transcript: str, model: str) -> list[str]:
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": (
                    "אתה מנהל מכירות שמזקק תובנות אימון קצרות וחדות מתוך שיחות מכירה. "
                    "אתה מחזיר JSON תקין בלבד."
                ),
            },
            {"role": "user", "content": build_insights_prompt(report=report, transcript=transcript)},
        ],
    )
    return parse_insights_json(getattr(response, "output_text", ""))


def safe_filename_part(value: str) -> str:
    value = value.strip().replace(" ", "_")
    value = re.sub(r"[^\w\u0590-\u05FF-]+", "", value)
    return value or "salesperson"


def save_report(report: str, salesperson_name: str) -> Path:
    REPORTS_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    safe_name = safe_filename_part(salesperson_name)
    report_path = REPORTS_DIR / f"{timestamp}_{safe_name}.md"
    report_path.write_text(report, encoding="utf-8")
    return report_path


def normalize_insight(insight: str) -> str:
    normalized = re.sub(r"[^\w\u0590-\u05FF]+", " ", insight.lower())
    return re.sub(r"\s+", " ", normalized).strip()


def load_saved_insights() -> list[dict]:
    if not INSIGHTS_PATH.exists():
        return []

    try:
        data = json.loads(INSIGHTS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        return []

    return [item for item in data if isinstance(item, dict) and item.get("text")]


def save_new_insights(insights: list[str], report_path: Path) -> int:
    REPORTS_DIR.mkdir(exist_ok=True)
    saved_insights = load_saved_insights()
    existing = {normalize_insight(str(item.get("text", ""))) for item in saved_insights}
    added_count = 0

    for insight in insights:
        normalized = normalize_insight(insight)
        is_duplicate = normalized in existing or any(
            SequenceMatcher(None, normalized, existing_insight).ratio() >= 0.88
            for existing_insight in existing
        )
        if not normalized or is_duplicate:
            continue

        saved_insights.append(
            {
                "text": insight,
                "report_file": report_path.name,
                "created_at": datetime.now().isoformat(timespec="seconds"),
            }
        )
        existing.add(normalized)
        added_count += 1

    INSIGHTS_PATH.write_text(
        json.dumps(saved_insights, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return added_count


def split_report_sections(report: str) -> dict[str, str]:
    sections = {}
    matches = list(re.finditer(r"^##\s+(.+?)\s*$", report, flags=re.MULTILINE))

    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(report)
        sections[title] = report[start:end].strip()

    return sections


def clean_markdown_value(value: str) -> str:
    value = value.strip().strip("*").strip()
    value = re.sub(r"\s{2,}", " ", value)
    return value


def extract_detail_value(details: str, label: str) -> str:
    pattern = rf"(?:^|\n)\s*(?:[-*]\s*)?{re.escape(label)}\s*:\s*(.+)"
    match = re.search(pattern, details)
    if not match:
        return ""
    return clean_markdown_value(match.group(1))


def extract_first_detail_value(details: str, labels: list[str]) -> str:
    for label in labels:
        value = extract_detail_value(details, label)
        if value:
            return value
    return ""


def extract_score(score_section: str) -> Optional[int]:
    match = re.search(r"(\d{1,3})\s*/\s*100", score_section)
    if not match:
        match = re.search(r"(\d{1,3})\s+מתוך\s+100", score_section)
    if not match:
        match = re.search(r"(\d{1,3})\s*%", score_section)
    if not match:
        match = re.search(r"(?:ציון|סיכוי|הובלה|ציון הובלה)\s*:?\s*(\d{1,3})", score_section)
    if not match:
        match = re.search(r"^\s*(\d{1,3})\s*(?:$|\n)", score_section)
    if not match:
        return None

    score = int(match.group(1))
    return max(0, min(score, 100))


def extract_labeled_score(text: str, label: str) -> Optional[int]:
    pattern = rf"{re.escape(label)}\s*:?\s*(\d{{1,3}})\s*%"
    match = re.search(pattern, text)
    if not match:
        return None
    return max(0, min(int(match.group(1)), 100))


def score_class(score: Optional[int]) -> str:
    if score is None:
        return ""
    if score >= 80:
        return "score-good"
    if score >= 60:
        return "score-mid"
    return "score-low"


def report_date_from_path(report_path: Path) -> str:
    match = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})", report_path.name)
    if match:
        date_text = f"{match.group(1)} {match.group(2).replace('-', ':')}"
        try:
            return datetime.strptime(date_text, "%Y-%m-%d %H:%M:%S").strftime("%d/%m/%Y %H:%M")
        except ValueError:
            pass

    return datetime.fromtimestamp(report_path.stat().st_mtime).strftime("%d/%m/%Y %H:%M")


def get_report_metadata(report_path: Path, report_text: str) -> dict:
    sections = split_report_sections(report_text)
    details = sections.get("פרטי השיחה", "")
    score = extract_score(sections.get("ציון כללי מתוך 100", ""))
    close_probability = (
        extract_labeled_score(report_text, "סיכוי סגירה בפועל")
        or extract_score(sections.get("הערכת סיכוי סגירה", "") or sections.get("סיכוי משוער לסגירת העסקה", ""))
    )
    improved_close_probability = extract_labeled_score(report_text, "סיכוי סגירה אם הכשל המרכזי היה מטופל נכון")
    leadership_score = extract_score(sections.get("הובלת השיחה", ""))
    customer_name = extract_first_detail_value(details, ["שם הלקוח", "שם הלקוח/ה"]) or "לקוח לא צוין"
    salesperson_name = extract_first_detail_value(
        details,
        ["שם איש/אשת המכירות", "שם אשת המכירות", "שם איש המכירות", "שם המוכר/ת"],
    ) or "לא צוין"

    return {
        "customer_name": customer_name,
        "salesperson_name": salesperson_name,
        "date": report_date_from_path(report_path),
        "score": score,
        "close_probability": close_probability,
        "improved_close_probability": improved_close_probability,
        "leadership_score": leadership_score,
    }


def extract_stage_scores(stage_section: str) -> list[dict]:
    stage_scores = []
    seen_stages = set()

    line_pattern = re.compile(
        r"(?:^|\n)\s*(?:[-*]\s*)?(?:\d+\.\s*)?(?:\*\*)?(?P<stage>[^|\n:]+?)(?:\*\*)?\s*"
        r"(?:\||:).*?ציון(?:\s+שלב)?\s*:?\s*(?P<score>\d{1,3})\s*(?:/|מתוך)?\s*100",
        flags=re.MULTILINE,
    )
    for match in line_pattern.finditer(stage_section):
        stage = clean_markdown_value(match.group("stage"))
        score = max(0, min(int(match.group("score")), 100))
        if stage and stage not in seen_stages:
            stage_scores.append({"שלב": stage, "ציון": score})
            seen_stages.add(stage)

    if stage_scores:
        return stage_scores

    block_pattern = re.compile(
        r"(?:^|\n)\s*(?:###\s*)?(?:\d+\.\s*)?(?:\*\*)?(?P<stage>[^*\n:]+?)(?:\*\*)?\s*"
        r"(?:\n|:).*?ציון(?:\s+שלב)?\s*:?\s*(?P<score>\d{1,3})\s*(?:/|מתוך)?\s*100",
        flags=re.DOTALL,
    )
    for match in block_pattern.finditer(stage_section):
        stage = clean_markdown_value(match.group("stage"))
        score = max(0, min(int(match.group("score")), 100))
        if stage and stage not in seen_stages:
            stage_scores.append({"שלב": stage, "ציון": score})
            seen_stages.add(stage)

    return stage_scores


def format_openai_error(exc: OpenAIError) -> str:
    error_text = str(exc)

    if "insufficient_quota" in error_text or "exceeded your current quota" in error_text:
        return (
            "אין כרגע quota/קרדיט זמין בחשבון OpenAI שמחובר למפתח הזה. "
            "צריך לבדוק Billing, להוסיף אמצעי תשלום או לרכוש קרדיט, ואז לנסות שוב."
        )

    if "invalid_api_key" in error_text or "Incorrect API key" in error_text:
        return "מפתח ה-OpenAI API לא תקין. בדוק שהעתקת את המפתח המלא ושהוא שייך לחשבון הנכון."

    if "input_too_large" in error_text or "audio is too large" in error_text:
        return (
            "קובץ האודיו ארוך מדי לתמלול במודל הנוכחי. "
            "נסה לקצר את הקובץ, להמיר אותו ל-m4a דחוס יותר, או לפצל את השיחה לשני קבצים."
        )

    if "Maximum content size limit" in error_text or "413" in error_text:
        return (
            "קובץ האודיו גדול מדי לשליחה ל-OpenAI. "
            "האפליקציה מנסה לדחוס קבצים גדולים אוטומטית, אבל אם זה חוזר - צריך לפצל את השיחה לשני קבצים."
        )

    if "Invalid file format" in error_text:
        return (
            "OpenAI לא זיהה את פורמט קובץ האודיו. "
            "נסה להעלות קובץ בפורמט m4a, mp3 או wav, או להמיר את ההקלטה מחדש ל-m4a."
        )

    return f"שגיאה בתקשורת מול OpenAI: {exc}"


def render_metric_card(label: str, value: str, css_class: str = "") -> None:
    st.markdown(
        f"""
        <div class="report-card">
            <div class="report-card-label">{html.escape(label)}</div>
            <div class="report-card-value {html.escape(css_class)}">{html.escape(value)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_insight_card(label: str, value: str, tone: str) -> None:
    tone_class = "insight-card-good" if tone == "good" else "insight-card-bad"
    st.markdown(
        f"""
        <div class="insight-card {tone_class}">
            <div>{html.escape(label)}</div>
            <div>{html.escape(clean_markdown_value(value))}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_conversation_axis_chart(stage_scores: list[dict]) -> None:
    if not stage_scores:
        return

    st.subheader("ציר השיחה לפי שלבי התסריט")
    reference_score = 70
    chart_data = pd.DataFrame(stage_scores)
    chart_data["קו ייחוס"] = reference_score

    line = (
        alt.Chart(chart_data)
        .mark_line(point=True, interpolate="monotone", strokeWidth=3)
        .encode(
            x=alt.X("שלב:N", sort=None, title="שלבי תסריט השיחה"),
            y=alt.Y("ציון:Q", scale=alt.Scale(domain=[0, 100]), title="ציון איש/אשת המכירות"),
            tooltip=["שלב:N", "ציון:Q"],
        )
    )
    reference = (
        alt.Chart(chart_data)
        .mark_rule(color="#dc2626", strokeDash=[6, 4], strokeWidth=2)
        .encode(y="קו ייחוס:Q")
    )
    reference_label = (
        alt.Chart(pd.DataFrame({"x": [stage_scores[-1]["שלב"]], "y": [reference_score], "label": ["קו ייחוס 70"]}))
        .mark_text(align="left", dx=8, dy=-8, color="#dc2626", fontWeight="bold")
        .encode(x=alt.X("x:N", sort=None), y="y:Q", text="label:N")
    )

    st.altair_chart((reference + line + reference_label).properties(height=320), use_container_width=True)


def render_report_dashboard(report: str, report_path: Path) -> None:
    sections = split_report_sections(report)
    metadata = get_report_metadata(report_path, report)
    stage_scores = extract_stage_scores(sections.get("ניתוח לפי שלבי תסריט המכירה", ""))
    close_probability = metadata.get("close_probability")
    close_probability_value = f"{close_probability}%" if isinstance(close_probability, int) else "לא זוהה"
    improved_close_probability = metadata.get("improved_close_probability")
    improved_close_probability_value = (
        f"{improved_close_probability}%" if isinstance(improved_close_probability, int) else "לא זוהה"
    )
    customer_name = html.escape(str(metadata["customer_name"]))
    salesperson_name = html.escape(str(metadata["salesperson_name"]))
    report_date = html.escape(str(metadata["date"]))

    st.markdown(
        f"""
        <div class="report-hero">
            <div class="report-eyebrow">דוח ניתוח שיחת מכירה</div>
            <div class="report-title">שיחה עם {customer_name}</div>
            <div class="report-subtitle">
                איש מכירות: {salesperson_name} | תאריך: {report_date}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        render_metric_card(
            "סיכוי בפועל",
            close_probability_value,
            score_class(close_probability if isinstance(close_probability, int) else None),
        )
    with col2:
        render_metric_card(
            "סיכוי אם הכשל מטופל",
            improved_close_probability_value,
            score_class(improved_close_probability if isinstance(improved_close_probability, int) else None),
        )
    with col3:
        render_metric_card("לקוח", str(metadata["customer_name"]))
    with col4:
        render_metric_card("איש מכירות", str(metadata["salesperson_name"]))

    render_conversation_axis_chart(stage_scores)

    for section_title in REPORT_SECTION_TITLES:
        if section_title in {"פרטי השיחה"}:
            continue

        section_body = sections.get(section_title)
        if not section_body:
            continue

        st.subheader(section_title)
        st.markdown(section_body)

    if sections.get("ניתוח לפי שלבי תסריט המכירה"):
        with st.expander("ניתוח לפי שלבי תסריט המכירה", expanded=False):
            st.markdown(sections["ניתוח לפי שלבי תסריט המכירה"])


def parse_transcript_turns(transcript: str) -> list[tuple[str, str]]:
    turns = []
    current_speaker = ""
    current_text_parts = []

    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = re.match(r"^\*\*(.+?):\*\*\s*(.*)$", line)
        if match:
            if current_speaker and current_text_parts:
                turns.append((current_speaker, " ".join(current_text_parts).strip()))
            current_speaker = clean_markdown_value(match.group(1))
            current_text_parts = [match.group(2).strip()] if match.group(2).strip() else []
        elif current_speaker:
            current_text_parts.append(line)

    if current_speaker and current_text_parts:
        turns.append((current_speaker, " ".join(current_text_parts).strip()))

    return turns


def render_transcript(transcript: str) -> None:
    turns = parse_transcript_turns(transcript)
    if not turns:
        st.text_area("התמלול", transcript, height=300)
        return

    for speaker, text in turns:
        st.markdown(
            f"""
            <div class="transcript-turn">
                <div class="transcript-speaker">{html.escape(speaker)}</div>
                <div class="transcript-text">{html.escape(text)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def render_results(transcript: str, report: str, report_path: Path) -> None:
    with st.expander("תמלול מלא", expanded=False):
        st.caption("התמלול מסודר לפי דוברים באופן משוער לפי ההקשר והשמות שהוזנו.")
        st.text_area("תמלול השיחה", transcript, height=360)

    st.subheader("דוח ניתוח")
    render_report_dashboard(report, report_path)

    st.download_button(
        label="הורד דוח Markdown",
        data=report.encode("utf-8"),
        file_name=report_path.name,
        mime="text/markdown",
    )

    st.success(f"הדוח נשמר בהצלחה: {report_path}")


def get_saved_reports() -> list[Path]:
    if not REPORTS_DIR.exists():
        return []
    return sorted(REPORTS_DIR.glob("*.md"), key=lambda path: path.stat().st_mtime, reverse=True)


def delete_report(report_path: Path) -> None:
    if report_path.exists() and report_path.parent == REPORTS_DIR:
        report_path.unlink()


def render_history_screen() -> None:
    st.subheader("היסטוריית דוחות")

    saved_reports = get_saved_reports()
    if not saved_reports:
        st.info("עדיין אין דוחות שמורים. אחרי ניתוח שיחה, הדוח יופיע כאן.")
        return

    selected_report_name = st.session_state.get("selected_report_name")
    available_names = {report.name for report in saved_reports}
    if selected_report_name not in available_names:
        selected_report_name = saved_reports[0].name
        st.session_state.selected_report_name = selected_report_name

    list_col, preview_col = st.columns([1, 2])

    with list_col:
        st.markdown("#### דוחות שמורים")
        for report_path in saved_reports:
            report_text = report_path.read_text(encoding="utf-8")
            metadata = get_report_metadata(report_path, report_text)
            score = metadata["score"]
            score_text = f"{score}/100" if isinstance(score, int) else "ללא ציון"
            customer_name = html.escape(str(metadata["customer_name"]))
            report_date = html.escape(str(metadata["date"]))
            salesperson_name = html.escape(str(metadata["salesperson_name"]))
            selected_border = "border-color: #2563eb;" if report_path.name == selected_report_name else ""

            st.markdown(
                f"""
                <div class="history-card" style="{selected_border}">
                    <div class="history-title">שיחה עם {customer_name}</div>
                    <div class="history-meta">{report_date}</div>
                    <div class="history-meta">איש מכירות: {salesperson_name} | ציון: {html.escape(score_text)}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            open_col, delete_col = st.columns(2)
            if open_col.button("פתח", key=f"open_{report_path.name}"):
                st.session_state.selected_report_name = report_path.name
                st.rerun()

            if delete_col.button("מחק", key=f"delete_{report_path.name}"):
                delete_report(report_path)
                if st.session_state.get("selected_report_name") == report_path.name:
                    st.session_state.selected_report_name = None
                st.rerun()

    selected_report = REPORTS_DIR / str(st.session_state.selected_report_name)
    if not selected_report.exists():
        st.info("הדוח שנבחר נמחק או לא נמצא.")
        return

    with preview_col:
        report_text = selected_report.read_text(encoding="utf-8")
        file_size_kb = selected_report.stat().st_size / 1024
        st.download_button(
            label="הורד דוח Markdown",
            data=report_text.encode("utf-8"),
            file_name=selected_report.name,
            mime="text/markdown",
            key=f"download_{selected_report.name}",
        )
        st.caption(f"גודל קובץ: {file_size_kb:.1f}KB")
        render_report_dashboard(report_text, selected_report)


def format_insight_date(created_at: str) -> str:
    try:
        return datetime.fromisoformat(created_at).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return created_at


def render_insights_screen() -> None:
    st.subheader("תובנות")
    st.caption("תובנות חדות שנאספו מתוך ניתוחי השיחות. תובנה קיימת לא נשמרת שוב.")

    saved_insights = load_saved_insights()
    if not saved_insights:
        st.info("עדיין אין תובנות שמורות. אחרי ניתוח שיחה, האפליקציה תחלץ 1-3 תובנות קריטיות לכאן.")
        return

    for index, insight in enumerate(reversed(saved_insights), start=1):
        report_file = str(insight.get("report_file", ""))
        created_at = format_insight_date(str(insight.get("created_at", "")))
        st.markdown(
            f"""
            <div class="learning-card">
                <div class="learning-title">תובנה {index}</div>
                <div>{html.escape(str(insight["text"]))}</div>
                <div class="learning-meta">נוצר מתוך: {html.escape(report_file)} | {html.escape(created_at)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def render_analysis_screen(api_key: str) -> None:
    default_model_index = 0
    if ANALYSIS_MODEL in ANALYSIS_MODEL_OPTIONS:
        default_model_index = ANALYSIS_MODEL_OPTIONS.index(ANALYSIS_MODEL)

    selected_model = st.selectbox(
        "מודל GPT לניתוח השיחה",
        options=ANALYSIS_MODEL_OPTIONS,
        index=default_model_index,
        help="הבחירה משפיעה על סידור הדוברים, ניתוח השיחה וחילוץ התובנות.",
    )
    uploaded_file = st.file_uploader("העלה קובץ אודיו", type=SUPPORTED_UPLOAD_EXTENSIONS)
    salesperson_name = st.text_input("שם איש/אשת המכירות")
    customer_name = st.text_input("שם הלקוח (אופציונלי - אם ריק ננסה לזהות מהשיחה)")

    if "transcript" not in st.session_state:
        st.session_state.transcript = ""
    if "report" not in st.session_state:
        st.session_state.report = ""
    if "report_path" not in st.session_state:
        st.session_state.report_path = None

    analyze_clicked = st.button("נתח שיחה", type="primary")

    if analyze_clicked:
        if uploaded_file is None:
            st.error("יש להעלות קובץ אודיו מסוג mp3, m4a או wav.")
            return
        if not salesperson_name.strip():
            st.error("יש להזין את שם איש/אשת המכירות.")
            return

        try:
            with st.spinner("מתמלל את השיחה..."):
                client = get_openai_client(api_key)
                raw_transcript = transcribe_audio(client, uploaded_file)

            with st.spinner("מסדר את התמלול לפי דוברים..."):
                transcript = format_transcript_by_speaker(
                    client=client,
                    raw_transcript=raw_transcript,
                    salesperson_name=salesperson_name.strip(),
                    customer_name=customer_name.strip(),
                    model=selected_model,
                )

            with st.spinner("מנתח את השיחה לפי תסריט המכירה..."):
                sales_script = read_sales_script()
                analysis_skill = read_analysis_skill()
                report = analyze_call(
                    client=client,
                    sales_script=sales_script,
                    analysis_skill=analysis_skill,
                    transcript=transcript,
                    salesperson_name=salesperson_name.strip(),
                    customer_name=customer_name.strip(),
                    model=selected_model,
                )
                report_path = save_report(report, salesperson_name.strip())

            added_insights = 0
            try:
                with st.spinner("מזקק תובנות לצוות המכירות..."):
                    insights = generate_call_insights(
                        client=client,
                        report=report,
                        transcript=transcript,
                        model=selected_model,
                    )
                    added_insights = save_new_insights(insights, report_path)
            except Exception as exc:
                st.warning(f"הדוח נשמר, אבל חילוץ התובנות נכשל: {exc}")

            st.session_state.transcript = transcript
            st.session_state.report = report
            st.session_state.report_path = report_path
            st.session_state.added_insights = added_insights

        except (ValueError, FileNotFoundError) as exc:
            st.error(str(exc))
        except OpenAIError as exc:
            st.error(format_openai_error(exc))
        except Exception as exc:
            st.error(f"שגיאה לא צפויה: {exc}")

    if st.session_state.transcript and st.session_state.report and st.session_state.report_path:
        render_results(
            transcript=st.session_state.transcript,
            report=st.session_state.report,
            report_path=st.session_state.report_path,
        )
        if "added_insights" in st.session_state:
            st.caption(f"נוספו {st.session_state.added_insights} תובנות חדשות למסך התובנות.")


def main() -> None:
    setup_page()

    api_key = get_configured_api_key()
    analysis_tab, history_tab, insights_tab = st.tabs(["ניתוח שיחה", "היסטוריית דוחות", "תובנות"])

    with analysis_tab:
        render_analysis_screen(api_key)

    with history_tab:
        render_history_screen()

    with insights_tab:
        render_insights_screen()


if __name__ == "__main__":
    main()
