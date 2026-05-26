import type { CalculatorFormProps } from '../CalculatorTypes';
import { WashCalculator } from './WashCalculator';

/** EPANET-style pipe network sizing via WASH pipe network submodule. */
export function PipeNetworkCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <WashCalculator
      inputs={{ ...inputs, wash_submodule: 'pipe_network' }}
      onInputChange={onInputChange}
    />
  );
}
