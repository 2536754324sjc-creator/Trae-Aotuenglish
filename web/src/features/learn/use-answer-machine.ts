'use client';

import { useCallback, useMemo, useReducer } from 'react';
import type { Question, Unit } from '@/lib/types';

/**
 * 答题状态机 —— 与界面解耦，纯逻辑。
 *
 * 规则（来自规划文档 §7.3）：
 * - 答错不扣星、不判负，允许重试；同一题第二次答错给出提示。
 * - 星星按「一次答对」的数量折算，最高 3 星。
 * - 中途退出即丢弃本单元进度。
 */

export type Phase = 'asking' | 'correct' | 'wrong';

export type AnswerState = {
  /** 当前题索引 */
  index: number;
  /** 当前阶段 */
  phase: Phase;
  /** 当前题已选的选项 id */
  selected: string | null;
  /** 当前题已尝试次数 */
  attempts: number;
  /** 是否在重试：答错过、尚未检查新答案，用来保持提示文案 */
  retrying: boolean;
  /** 一次答对的题数 */
  firstTryCount: number;
  /** 每题是否一次答对，用于结算页回看 */
  results: boolean[];
  /** 是否已答完全部题目 */
  finished: boolean;
};

type Action =
  | { type: 'select'; optionId: string }
  | { type: 'check' }
  | { type: 'next' }
  | { type: 'reset' };

function initialState(unit: Unit): AnswerState {
  return {
    index: 0,
    phase: 'asking',
    selected: null,
    attempts: 0,
    retrying: false,
    firstTryCount: 0,
    results: unit.questions.map(() => false),
    finished: false,
  };
}

function reducer(unit: Unit) {
  return function reduce(state: AnswerState, action: Action): AnswerState {
    const question = unit.questions[state.index];

    switch (action.type) {
      case 'select': {
        // 答对后锁定；答错后允许重选，retrying 保留提示文案
        if (state.phase === 'correct') return state;
        return {
          ...state,
          phase: 'asking',
          selected: action.optionId,
          retrying: state.attempts > 0,
        };
      }

      case 'check': {
        // 只在「已选、且还没答对」时允许提交
        if (state.phase === 'correct' || !state.selected || !question) return state;
        const option = question.options.find((o) => o.id === state.selected);
        const isCorrect = Boolean(option?.correct);
        const attempts = state.attempts + 1;

        if (isCorrect) {
          const firstTry = attempts === 1;
          const results = [...state.results];
          results[state.index] = firstTry;
          return {
            ...state,
            phase: 'correct',
            attempts,
            retrying: false,
            results,
            firstTryCount: state.firstTryCount + (firstTry ? 1 : 0),
          };
        }

        // 答错：清掉选择，允许重选
        return { ...state, phase: 'wrong', attempts, selected: null, retrying: true };
      }

      case 'next': {
        const isLast = state.index >= unit.questions.length - 1;
        if (isLast) {
          return { ...state, finished: true, phase: 'asking', selected: null };
        }
        return {
          ...state,
          index: state.index + 1,
          phase: 'asking',
          selected: null,
          attempts: 0,
          retrying: false,
        };
      }

      case 'reset':
        return initialState(unit);

      default:
        return state;
    }
  };
}

export function useAnswerMachine(unit: Unit) {
  const reduce = useMemo(() => reducer(unit), [unit]);
  const [state, dispatch] = useReducer(reduce, unit, initialState);

  const question: Question | undefined = unit.questions[state.index];

  const select = useCallback((optionId: string) => dispatch({ type: 'select', optionId }), []);
  const check = useCallback(() => dispatch({ type: 'check' }), []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  /** 3 星按一次答对比例折算：全对 3 星，≥70% 2 星，其余 1 星 */
  const stars = useMemo(() => {
    const total = unit.questions.length;
    if (total === 0) return 1;
    const ratio = state.firstTryCount / total;
    if (ratio >= 1) return 3;
    if (ratio >= 0.7) return 2;
    return 1;
  }, [state.firstTryCount, unit.questions.length]);

  /** 结算是「一次答对」之后才允许，避免误判 */
  const canCheck = state.phase === 'asking' && state.selected !== null;
  const showRetryHint = state.retrying;

  return {
    state,
    question,
    total: unit.questions.length,
    current: state.index + 1,
    canCheck,
    showRetryHint,
    stars,
    select,
    check,
    next,
    reset,
  };
}
