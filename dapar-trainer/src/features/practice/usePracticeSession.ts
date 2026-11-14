import { useCallback, useEffect, useRef, useState } from 'react';
import { adaptiveStep, initialAdaptive, type AdaptiveState } from '../../engine/adaptive';
import type { Reward } from '../../engine/gamification';
import { makeItem, pickDifficulty, QuestionPicker, type ItemResult, type SessionItem, type SessionSettings } from '../../engine/session';
import type { ChoiceId } from '../../questions/types';
import { useProgress, type Attempt, type SessionRecord } from '../../store/progress';

export type Phase = 'answering' | 'feedback' | 'done';

interface State {
  items: SessionItem[];
  index: number;
  phase: Phase;
  adaptive: AdaptiveState;
}

/**
 * מנהל סשן תרגול עם משוב מיידי.
 * הלוגיקה עם אקראיות רצה מחוץ ל-setState כדי שתהיה בטוחה ב-StrictMode.
 */
export function usePracticeSession(settings: SessionSettings) {
  const pickerRef = useRef<QuestionPicker | null>(null);
  const sessionIdRef = useRef(`s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  const startedAtRef = useRef(Date.now());
  const questionStartRef = useRef(Date.now());
  const committedRef = useRef(false);
  const commitSession = useProgress((s) => s.commitSession);
  const [reward, setReward] = useState<Reward | null>(null);

  // האתחול נעשה פעם אחת בתוך ref, כדי שה-initializer של useState יהיה טהור (StrictMode קורא לו פעמיים)
  const initRef = useRef<State | null>(null);
  if (!initRef.current) {
    const picker = new QuestionPicker(settings);
    pickerRef.current = picker;
    const adaptive = initialAdaptive();
    const q = picker.next(pickDifficulty(settings.difficulty, adaptive.level, picker.rngRef));
    initRef.current = { items: q ? [makeItem(q, picker.rngRef)] : [], index: 0, phase: q ? 'answering' : 'done', adaptive };
  }
  const [state, setState] = useState<State>(() => initRef.current!);
  const stateRef = useRef(state);
  stateRef.current = state;

  const total = pickerRef.current!.capacity;

  const finishCurrent = useCallback((chosen: ChoiceId | null) => {
    const s = stateRef.current;
    if (s.phase !== 'answering') return;
    const item = s.items[s.index];
    const result: ItemResult = chosen === null ? 'timeout' : chosen === item.question.correctChoiceId ? 'correct' : 'wrong';
    const items = [...s.items];
    items[s.index] = { ...item, chosen, result, timeMs: Date.now() - questionStartRef.current };
    setState({ ...s, items, phase: 'feedback', adaptive: adaptiveStep(s.adaptive, result === 'correct') });
  }, []);

  const answer = useCallback((id: ChoiceId) => finishCurrent(id), [finishCurrent]);
  const timeout = useCallback(() => finishCurrent(null), [finishCurrent]);

  const next = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'feedback') return;
    const picker = pickerRef.current!;
    if (s.items.length >= picker.capacity) {
      setState({ ...s, phase: 'done' });
      return;
    }
    const q = picker.next(pickDifficulty(settings.difficulty, s.adaptive.level, picker.rngRef));
    if (!q) {
      setState({ ...s, phase: 'done' });
      return;
    }
    questionStartRef.current = Date.now();
    setState({ ...s, items: [...s.items, makeItem(q, picker.rngRef)], index: s.index + 1, phase: 'answering' });
  }, [settings.difficulty]);

  // שמירת התוצאות פעם אחת בסוף הסשן
  useEffect(() => {
    if (state.phase !== 'done' || committedRef.current) return;
    committedRef.current = true;
    const answered = state.items.filter((i) => i.result !== null);
    if (answered.length === 0) return;
    const now = Date.now();
    const attempts: Attempt[] = answered.map((i) => ({
      qid: i.question.id,
      topic: i.question.topic,
      subtopic: i.question.subtopic,
      difficulty: i.question.difficulty,
      result: i.result!,
      timeMs: i.timeMs,
      at: now,
      sessionId: sessionIdRef.current,
    }));
    const record: SessionRecord = {
      id: sessionIdRef.current,
      mode: settings.mode,
      topics: settings.topics,
      difficulty: settings.difficulty,
      total: answered.length,
      correct: answered.filter((i) => i.result === 'correct').length,
      wrong: answered.filter((i) => i.result === 'wrong').length,
      timeout: answered.filter((i) => i.result === 'timeout').length,
      avgTimeMs: Math.round(answered.reduce((s, i) => s + i.timeMs, 0) / answered.length),
      startedAt: startedAtRef.current,
      endedAt: now,
    };
    setReward(commitSession(record, attempts));
  }, [state.phase, state.items, settings, commitSession]);

  const finishEarly = useCallback(() => {
    const s = stateRef.current;
    setState({ ...s, phase: 'done' });
  }, []);

  return { ...state, total, reward, current: state.items[state.index], answer, timeout, next, finishEarly };
}
