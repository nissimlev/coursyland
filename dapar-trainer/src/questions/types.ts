// ------------------------------------------------------------
// מודל הנתונים של השאלות
// ------------------------------------------------------------

export type Topic = 'verbal' | 'instructions' | 'quantitative' | 'matrices';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultySetting = Difficulty | 'mixed' | 'adaptive';

export type ChoiceId = 'a' | 'b' | 'c' | 'd';
export const CHOICE_IDS: readonly ChoiceId[] = ['a', 'b', 'c', 'd'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export type VerbalSubtopic = 'analogy' | 'completion' | 'synonym' | 'antonym' | 'odd-one-out';
export type InstructionsSubtopic = 'rules-apply' | 'procedure' | 'coding' | 'scheduling';
export type QuantitativeSubtopic = 'series' | 'word-problem' | 'arithmetic' | 'percent-ratio';
export type MatricesSubtopic = 'rotation' | 'add-element' | 'fill-color' | 'count' | 'combined';
export type Subtopic = VerbalSubtopic | InstructionsSubtopic | QuantitativeSubtopic | MatricesSubtopic;

// ---------- תוכן ----------

/** קטע טקסט. ltr=true לביטויים מתמטיים וסדרות, כדי שלא יתהפכו בתוך דף RTL */
export interface TextContent {
  kind: 'text';
  text: string;
  ltr?: boolean;
}

export type ShapeName = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'pentagon' | 'star' | 'cross' | 'arrow' | 'flag';
export type FillName = 'none' | 'striped' | 'solid';
export type ColorName = 'violet' | 'sky' | 'amber' | 'rose' | 'emerald';

/** משבצת אחת במטריצה */
export interface MatrixCell {
  shape: ShapeName;
  /** מספר הצורות במשבצת (1–4) */
  count: number;
  fill: FillName;
  color: ColorName;
  /** סיבוב במעלות, עם כיוון השעון */
  rotation: number;
  /** נקודות קטנות בתחתית המשבצת (0–5) */
  dots: number;
}

export type Figure =
  | { type: 'matrix'; cells: (MatrixCell | null)[] } // 9 משבצות, null = החסרה
  | { type: 'cell'; cell: MatrixCell };

export interface FigureContent {
  kind: 'figure';
  figure: Figure;
  /** תיאור טקסטואלי לנגישות */
  alt: string;
}

export type Content = TextContent | FigureContent;

export interface Choice {
  id: ChoiceId;
  content: Content;
  /** ערך מספרי לאימות אוטומטי (אם חסר, נלקח המספר הראשון שמופיע בטקסט) */
  value?: number;
}

// ---------- אימות אוטומטי: כמותי ----------

export interface SeriesOp {
  op: '+' | '-' | '*' | '/';
  v: number;
}

export type SeriesRule =
  | { type: 'add'; d: number } // x → x + d
  | { type: 'mul'; r: number } // x → x · r
  | { type: 'addInc'; d: number; inc: number } // ההפרש גדל ב-inc בכל צעד
  | { type: 'mulAdd'; m: number; a: number } // x → x · m + a
  | { type: 'cycle'; ops: SeriesOp[] } // פעולות מתחלפות במחזוריות
  | { type: 'interleave'; a: SeriesRule; b: SeriesRule } // שתי סדרות שזורות
  | { type: 'sumPrev' } // כל איבר = סכום שני הקודמים
  | { type: 'power'; exp: number; offset: number; startN: number }; // n^exp + offset

// ---------- אימות אוטומטי: הבנת הוראות ----------

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { attr: string; op: '=' | '>=' | '<=' | '>' | '<'; value: number | boolean | string };

export type DigitOp = { op: 'add' | 'sub' | 'mul'; v: number } | { op: 'comp9' };
export type NumCond = { even: true } | { odd: true } | { gt: number } | { lt: number } | { divisibleBy: number };
export type NumOp = { op: 'add' | 'sub' | 'mul' | 'div'; v: number } | { op: 'addUnits' } | { op: 'digitSum' } | { op: 'reverseDigits' };
export interface ProcStep {
  if?: NumCond;
  then: NumOp[];
  else?: NumOp[];
}

export type AssignConstraint =
  | { type: 'is'; person: string; slot: number }
  | { type: 'not'; person: string; slot: number }
  /** slot(b) = slot(a) + diff */
  | { type: 'offset'; a: string; b: string; diff: number }
  /** slot(a) < slot(b) */
  | { type: 'before'; a: string; b: string };

export type InstructionSpec =
  | { family: 'digit-code'; all?: DigitOp[]; odd?: DigitOp[]; even?: DigitOp[]; reverse?: boolean; swapHalves?: boolean }
  | { family: 'letter-code'; shift?: number; atbash?: boolean; swapEnds?: boolean }
  | { family: 'eligibility'; rule: Cond }
  | { family: 'procedure'; steps: ProcStep[]; repeat: number }
  | { family: 'robot'; cols: number; rows: number; obstacles: string[] }
  | {
      family: 'priority';
      people: Record<string, Record<string, number | boolean>>;
      derived?: Record<string, Cond>;
      keys: { attr: string; dir: 'asc' | 'desc' }[];
    }
  | { family: 'assignment'; people: string[]; slots: string[]; constraints: AssignConstraint[] };

export interface Candidate {
  name: string;
  attrs: Record<string, number | boolean>;
}

export type Assertion = { person: string; slot: number } | { person: string; notSlot: number };

export type InstructionQuery =
  | { type: 'encode'; input: string }
  | { type: 'decode'; output: string }
  | { type: 'eligible-one'; candidates: Candidate[] }
  | { type: 'not-eligible-one'; candidates: Candidate[] }
  | { type: 'count-eligible'; candidates: Candidate[] }
  | { type: 'run'; input: number }
  /** inputs מקבילים לתשובות a–d; התשובה היא הקלט היחיד שנותן את output */
  | { type: 'find-input'; output: number; inputs: number[] }
  | { type: 'robot-final'; start: string; commands: string }
  | { type: 'position'; n: number }
  | { type: 'position-of'; name: string }
  | { type: 'slot-of'; person: string; extra?: AssignConstraint[] }
  | { type: 'who-in'; slot: number; extra?: AssignConstraint[] }
  /** options מקבילים לתשובות a–d; בדיוק אחת חייבת להיות נכונה בכל הפתרונות */
  | { type: 'must-be-true'; options: Assertion[] };

export interface Passage {
  id: string;
  title: string;
  /** פסקאות מופרדות בשורה חדשה */
  text: string;
  spec: InstructionSpec;
}

export type VerifySpec =
  | { kind: 'expr'; expr: string }
  | { kind: 'series'; rule: SeriesRule; start: number[]; shown: number }
  /** הפותר מסיק את החוקיות מתוך המטריצה עצמה */
  | { kind: 'matrix' }
  | { kind: 'instructions'; query: InstructionQuery };

// ---------- השאלה ----------

export interface Question {
  /** מזהה יציב. שאלות מחוללות: gen:<generator>:<difficulty>:<seed> */
  id: string;
  topic: Topic;
  subtopic: Subtopic;
  difficulty: Difficulty;
  /** להבנת הוראות: הקטע שעליו נשאלת השאלה */
  passage?: Passage;
  prompt: Content[];
  choices: Choice[];
  correctChoiceId: ChoiceId;
  explanation: string;
  verify?: VerifySpec;
  /** true = השאלה לא מוצגת בתרגול עד בדיקה ידנית */
  needsReview?: boolean;
  reviewNote?: string;
  generated?: boolean;
}

// ---------- פורמט הכתיבה בקבצי JSON ----------
// כדי שיהיה קל להוסיף שאלות, ה-JSON כתוב בצורה מקוצרת ומומר ל-Question בטעינה.

export type RawText = string | { text: string; ltr?: boolean };
export type RawChoice = string | { text: string; value?: number; ltr?: boolean };

export interface RawQuestion {
  id: string;
  subtopic: Subtopic;
  difficulty: Difficulty;
  passageId?: string;
  prompt: RawText | RawText[];
  /** ארבע תשובות לפי הסדר a, b, c, d */
  choices: RawChoice[];
  correct: ChoiceId;
  explanation: string;
  verify?: VerifySpec;
  needsReview?: boolean;
  reviewNote?: string;
}

/** מטריצה במאגר: נשמרת כמפרט חוקיות, והציור והמסיחים נבנים ממנו */
export interface RawMatrixQuestion {
  id: string;
  subtopic: MatricesSubtopic;
  difficulty: Difficulty;
  spec: import('./matrices/model').MatrixSpec;
  /** seed לבחירת המסיחים */
  seed: number;
  needsReview?: boolean;
  reviewNote?: string;
}
