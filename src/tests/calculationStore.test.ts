import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCalculationStore } from '../store/calculationStore';

// Reset store before each test
beforeEach(() => {
  useCalculationStore.setState({
    activeModule: 'beam',
    currentInputs: {},
    currentResults: null,
    isCalculating: false,
    error: null,
  });
});

describe('calculationStore — module switching', () => {
  it('sets active module to beam', () => {
    useCalculationStore.getState().setModule('beam');
    expect(useCalculationStore.getState().activeModule).toBe('beam');
  });

  it('sets active module to slab', () => {
    useCalculationStore.getState().setModule('slab');
    expect(useCalculationStore.getState().activeModule).toBe('slab');
  });

  it('sets active module to column', () => {
    useCalculationStore.getState().setModule('column');
    expect(useCalculationStore.getState().activeModule).toBe('column');
  });

  it('sets active module to foundation', () => {
    useCalculationStore.getState().setModule('foundation');
    expect(useCalculationStore.getState().activeModule).toBe('foundation');
  });

  it('clears error when switching module', () => {
    useCalculationStore.setState({ error: 'previous error' });
    useCalculationStore.getState().setModule('slab');
    expect(useCalculationStore.getState().error).toBeNull();
  });

  it('clears results when switching module', () => {
    useCalculationStore.setState({ currentResults: { status: 'pass' } as any });
    useCalculationStore.getState().setModule('column');
    expect(useCalculationStore.getState().currentResults).toBeNull();
  });
});

describe('calculationStore — input management', () => {
  it('sets a single input key', () => {
    useCalculationStore.getState().setInput('span', 6.5);
    expect(useCalculationStore.getState().currentInputs.span).toBe(6.5);
  });

  it('sets multiple input keys independently', () => {
    useCalculationStore.getState().setInput('b_mm', 300);
    useCalculationStore.getState().setInput('h_mm', 550);
    const { currentInputs } = useCalculationStore.getState();
    expect(currentInputs.b_mm).toBe(300);
    expect(currentInputs.h_mm).toBe(550);
  });

  it('overwrites existing input value', () => {
    useCalculationStore.getState().setInput('span', 5.0);
    useCalculationStore.getState().setInput('span', 8.0);
    expect(useCalculationStore.getState().currentInputs.span).toBe(8.0);
  });

  it('does not lose other inputs when one is updated', () => {
    useCalculationStore.getState().setInput('span', 6.0);
    useCalculationStore.getState().setInput('fck_mpa', 30);
    useCalculationStore.getState().setInput('span', 7.0);
    expect(useCalculationStore.getState().currentInputs.fck_mpa).toBe(30);
  });

  it('accepts zero as a valid input value', () => {
    useCalculationStore.getState().setInput('M_x_knm', 0);
    expect(useCalculationStore.getState().currentInputs.M_x_knm).toBe(0);
  });

  it('accepts string input values', () => {
    useCalculationStore.getState().setInput('support_condition', 'simply_supported');
    expect(useCalculationStore.getState().currentInputs.support_condition).toBe('simply_supported');
  });
});

describe('calculationStore — calculation state', () => {
  it('isCalculating starts false', () => {
    expect(useCalculationStore.getState().isCalculating).toBe(false);
  });

  it('error starts null', () => {
    expect(useCalculationStore.getState().error).toBeNull();
  });

  it('currentResults starts null', () => {
    expect(useCalculationStore.getState().currentResults).toBeNull();
  });

  it('can set error state directly', () => {
    useCalculationStore.setState({ error: 'API timeout' });
    expect(useCalculationStore.getState().error).toBe('API timeout');
  });
});
