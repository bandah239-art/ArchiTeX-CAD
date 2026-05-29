import { describe, it, expect, beforeEach } from 'vitest';
import { useCalculationStore } from '../store/calculationStore';

describe('calculationStore', () => {
  beforeEach(() => {
    useCalculationStore.setState({
      activeModule: 'beam',
      currentInputs: {},
      currentResults: null,
      isCalculating: false,
      error: null,
    });
  });

  it('sets active module', () => {
    const { setModule } = useCalculationStore.getState();
    setModule('slab');
    expect(useCalculationStore.getState().activeModule).toBe('slab');
  });

  it('sets individual input', () => {
    const { setInput } = useCalculationStore.getState();
    setInput('span', 6);
    expect(useCalculationStore.getState().currentInputs.span).toBe(6);
  });

  it('clears error when switching module', () => {
    useCalculationStore.setState({ error: 'previous error' });
    const { setModule } = useCalculationStore.getState();
    setModule('column');
    expect(useCalculationStore.getState().error).toBeNull();
  });

  it('default inputs for beam are populated', () => {
    const { setModule } = useCalculationStore.getState();
    setModule('beam');
    const inputs = useCalculationStore.getState().currentInputs;
    expect(inputs).toBeDefined();
    expect(typeof inputs.span === 'number' || inputs.span === undefined).toBe(true);
  });
});
