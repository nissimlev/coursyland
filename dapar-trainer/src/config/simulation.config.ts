import type { Difficulty, Topic } from '../questions/types';

/**
 * הגדרות סימולציית מבחן הדפ״ר. כל המספרים כאן, כדי שיהיה קל לעדכן אותם.
 *
 * מה ידוע (נבדק בנובמבר 2026):
 * - במבחן ארבעה פרקים: אנלוגיות מילוליות, חשיבה כמותית, הבנת הוראות ואנלוגיות צורניות.
 * - המבחן ממוחשב ואדפטיבי: מתחילים ברמה בינונית והקושי משתנה לפי ההצלחה.
 * - בכל פרק 10–30 שאלות, והמבחן כולו נמשך כ-40 דקות.
 * - הציון הכללי 10–90, ולכל פרק ציון 1–9. מותר להשתמש במחשבון.
 * - הזמן לכל שאלה לא פורסם רשמית. מכוני הכנה מציינים כ-30 שניות לשאלה מילולית,
 *   כ-40 שניות לשאלה צורנית וכ-90 שניות לשאלה כמותית. הערכים כאן מבוססים על כך.
 *
 * הבדלים מכוונים מהמבחן האמיתי: כאן אפשר לנווט בין שאלות בתוך הפרק ולסמן שאלות לחזרה,
 * ולכל פרק יש זמן כולל (ולא זמן לשאלה).
 */
export interface SectionConfig {
  topic: Topic;
  questions: number;
  minutes: number;
}

export const SIMULATION_CONFIG = {
  sections: [
    { topic: 'verbal', questions: 15, minutes: 8 },
    { topic: 'quantitative', questions: 12, minutes: 14 },
    { topic: 'instructions', questions: 12, minutes: 10 },
    { topic: 'matrices', questions: 15, minutes: 10 },
  ] as SectionConfig[],

  /** חלוקת רמות הקושי בכל פרק */
  difficultyMix: { easy: 0.3, medium: 0.4, hard: 0.3 } as Record<Difficulty, number>,

  /** משקל כל פרק בציון המשוקלל (לא פורסם רשמית; כאן משקל שווה) */
  weights: { verbal: 1, quantitative: 1, instructions: 1, matrices: 1 } as Record<Topic, number>,

  /** משקל של תשובה נכונה לפי רמת הקושי, כדי לדמות במעט מבחן אדפטיבי */
  difficultyWeight: { easy: 1, medium: 1.25, hard: 1.5 } as Record<Difficulty, number>,

  sources: [
    { label: 'מתגייסים: לומדת דפ״ר אדפטיבי', url: 'https://www.mitgaisim.idf.il/%D7%9B%D7%AA%D7%91%D7%95%D7%AA/%D7%9B%D7%AA%D7%91%D7%95%D7%AA-%D7%A6%D7%99%D7%A8-%D7%94%D7%96%D7%9E%D7%9F/%D7%A6%D7%95-%D7%A8%D7%90%D7%A9%D7%95%D7%9F/%D7%9C%D7%95%D7%9E%D7%93%D7%AA-%D7%93%D7%A4%D7%A8-%D7%90%D7%93%D7%A4%D7%98%D7%99%D7%91%D7%99/' },
    { label: 'מתגייסים (אנגלית): Preparation for the Dapar exam', url: 'https://www.mitgaisim.idf.il/%D7%9B%D7%AA%D7%91%D7%95%D7%AA/english/tzav-rishon/preparation-for-the-dapar-exam/' },
    { label: 'מכוון: מה זה דפ״ר (זמנים משוערים לשאלה)', url: 'https://www.michvan.co.il/pages/5/%D7%A6%D7%95_%D7%A8%D7%90%D7%A9%D7%95%D7%9F-%D7%93%D7%A4%22%D7%A8_%D7%95%D7%9E%D7%91%D7%97%D7%A0%D7%99_%D7%93%D7%A4%D7%A8' },
  ],
};
