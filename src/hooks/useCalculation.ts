import { useCallback, useEffect, useState } from 'react';
import { useCalculationStore } from '../store/calculationStore';
import { calculationAPI } from '../services/calculationAPI';

export function useCalculation() {
  const { runCalculation, isCalculating, currentResults, error, clearResults } =
    useCalculationStore();
  const [serverOnline, setServerOnline] = useState(false);

  useEffect(() => {
    calculationAPI.checkHealth().then(setServerOnline);
    const interval = setInterval(() => {
      calculationAPI.checkHealth().then(setServerOnline);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const calculate = useCallback(async () => {
    await runCalculation();
  }, [runCalculation]);

  return {
    calculate,
    isCalculating,
    currentResults,
    error,
    clearResults,
    serverOnline,
  };
}
