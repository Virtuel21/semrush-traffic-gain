import React, { useState } from 'react';

type Cohort = 'A' | 'B' | 'C';

interface CohortRule {
  positionFrom: string;
  positionTo: string;
  kdFrom: string;
  kdTo: string;
  serp: string;
  intent: string;
  country: string;
  device: string;
  probA: string;
  probB: string;
  probC: string;
  cohortOverride: '' | Cohort;
}

const createEmptyRule = (): CohortRule => ({
  positionFrom: '',
  positionTo: '',
  kdFrom: '',
  kdTo: '',
  serp: '',
  intent: '',
  country: '',
  device: '',
  probA: '0.3',
  probB: '0.3',
  probC: '0.3',
  cohortOverride: ''
});

const CohortRulesEditor: React.FC = () => {
  const [rules, setRules] = useState<CohortRule[]>([createEmptyRule()]);

  const updateRule = (index: number, field: keyof CohortRule, value: string) => {
    setRules(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRule = () => {
    setRules(prev => [...prev, createEmptyRule()]);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Cohort Rules Editor</h2>
        <button
          onClick={addRule}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Add Rule
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-3 text-left font-medium text-gray-500">Position</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">KD</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">SERP Features</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">Intent</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">Country</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">Device</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">A</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">B</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">C</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">B1120</th>
              <th className="px-2 py-3 text-left font-medium text-gray-500">Override</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rules.map((rule, idx) => {
              const a = parseFloat(rule.probA) || 0;
              const b = parseFloat(rule.probB) || 0;
              const c = parseFloat(rule.probC) || 0;
              const sum = a + b + c;
              const leftover = sum <= 1 ? 1 - sum : 0;
              const error = sum > 1;
              return (
                <tr key={idx} className={error ? 'bg-red-50' : ''}>
                  <td className="px-2 py-2">
                    <div className="flex space-x-1">
                      <input
                        type="number"
                        value={rule.positionFrom}
                        onChange={e => updateRule(idx, 'positionFrom', e.target.value)}
                        className="w-16 border rounded px-1 py-0.5"
                        placeholder="from"
                      />
                      <input
                        type="number"
                        value={rule.positionTo}
                        onChange={e => updateRule(idx, 'positionTo', e.target.value)}
                        className="w-16 border rounded px-1 py-0.5"
                        placeholder="to"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex space-x-1">
                      <input
                        type="number"
                        value={rule.kdFrom}
                        onChange={e => updateRule(idx, 'kdFrom', e.target.value)}
                        className="w-16 border rounded px-1 py-0.5"
                        placeholder="from"
                      />
                      <input
                        type="number"
                        value={rule.kdTo}
                        onChange={e => updateRule(idx, 'kdTo', e.target.value)}
                        className="w-16 border rounded px-1 py-0.5"
                        placeholder="to"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={rule.serp}
                      onChange={e => updateRule(idx, 'serp', e.target.value)}
                      className="w-32 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={rule.intent}
                      onChange={e => updateRule(idx, 'intent', e.target.value)}
                      className="w-24 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={rule.country}
                      onChange={e => updateRule(idx, 'country', e.target.value)}
                      className="w-24 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={rule.device}
                      onChange={e => updateRule(idx, 'device', e.target.value)}
                      className="w-24 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={rule.probA}
                      onChange={e => updateRule(idx, 'probA', e.target.value)}
                      className="w-16 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={rule.probB}
                      onChange={e => updateRule(idx, 'probB', e.target.value)}
                      className="w-16 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={rule.probC}
                      onChange={e => updateRule(idx, 'probC', e.target.value)}
                      className="w-16 border rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className={error ? 'text-red-600 font-medium' : ''}>{leftover.toFixed(2)}</span>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={rule.cohortOverride}
                      onChange={e => updateRule(idx, 'cohortOverride', e.target.value)}
                      className="border rounded px-1 py-0.5"
                    >
                      <option value="">None</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CohortRulesEditor;

