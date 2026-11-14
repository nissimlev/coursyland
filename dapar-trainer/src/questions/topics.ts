import type { Difficulty, DifficultySetting, Subtopic, Topic } from './types';

export interface TopicMeta {
  id: Topic;
  name: string;
  short: string;
  description: string;
  emoji: string;
  /** מחלקות Tailwind מלאות (כדי שה-JIT יזהה אותן) */
  gradient: string;
  chip: string;
}

export const TOPICS: Record<Topic, TopicMeta> = {
  verbal: {
    id: 'verbal',
    name: 'שאלות מילוליות',
    short: 'מילולי',
    description: 'אנלוגיות, השלמת משפטים, מילים נרדפות והפכים, יוצא דופן',
    emoji: '📝',
    gradient: 'from-sky-500 to-cyan-400',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  },
  instructions: {
    id: 'instructions',
    name: 'הבנת הוראות',
    short: 'הוראות',
    description: 'קריאת חוקים והוראות, ויישום שלהם על מקרים חדשים',
    emoji: '📋',
    gradient: 'from-amber-500 to-orange-400',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  },
  quantitative: {
    id: 'quantitative',
    name: 'שאלות כמותיות',
    short: 'כמותי',
    description: 'סדרות מספרים, בעיות מילוליות, חשבון, אחוזים ויחסים',
    emoji: '🔢',
    gradient: 'from-violet-600 to-fuchsia-500',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300',
  },
  matrices: {
    id: 'matrices',
    name: 'מטריצות וצורות',
    short: 'מטריצות',
    description: 'זיהוי חוקיות ברצף של צורות: סיבוב, הוספה, צבע וספירה',
    emoji: '🔷',
    gradient: 'from-emerald-500 to-teal-400',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  },
};

export const TOPIC_ORDER: Topic[] = ['verbal', 'instructions', 'quantitative', 'matrices'];

export const SUBTOPIC_NAMES: Record<Subtopic, string> = {
  analogy: 'אנלוגיות',
  completion: 'השלמת משפטים',
  synonym: 'מילים נרדפות',
  antonym: 'הפכים',
  'odd-one-out': 'יוצא דופן',
  'rules-apply': 'יישום חוקים',
  procedure: 'תהליך והוראות',
  coding: 'קידוד',
  scheduling: 'שיבוץ',
  series: 'סדרות',
  'word-problem': 'בעיות מילוליות',
  arithmetic: 'חשבון',
  'percent-ratio': 'אחוזים ויחסים',
  rotation: 'סיבוב',
  'add-element': 'הוספת אלמנט',
  'fill-color': 'צבע ומילוי',
  count: 'ספירה',
  combined: 'חוקיות משולבת',
};

export const DIFFICULTY_NAMES: Record<DifficultySetting, string> = {
  easy: 'קל',
  medium: 'בינוני',
  hard: 'קשה',
  mixed: 'מעורב',
  adaptive: 'אדפטיבי',
};

export const DIFFICULTY_CHIP: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  hard: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300',
};
