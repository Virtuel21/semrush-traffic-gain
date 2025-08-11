import React, { useState, useCallback, useMemo } from 'react';
import { Upload, Download, RotateCcw, TrendingUp, Search, Target } from 'lucide-react';
import * as XLSX from 'xlsx';

interface KeywordData {
  keyword: string;
  position: number;
  searchVolume: number;
  currentTraffic?: number;
}

interface ProcessedKeyword extends KeywordData {
  estimatedCurrentTraffic: number;
  trafficPosition3: number;
  trafficPosition2: number;
  trafficPosition1: number;
  gainPosition3: number;
  gainPosition2: number;
  gainPosition1: number;
}

// Industry standard CTR values by position
const DEFAULT_CTR_VALUES: { [key: number]: number } = {
  1: 28.5, 2: 15.7, 3: 11.0, 4: 8.0, 5: 6.1,
  6: 4.8, 7: 3.8, 8: 3.0, 9: 2.5, 10: 2.1,
  11: 1.8, 12: 1.5, 13: 1.3, 14: 1.1, 15: 1.0,
  16: 0.9, 17: 0.8, 18: 0.7, 19: 0.6, 20: 0.5
};

function App() {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [ctrValues, setCtrValues] = useState<{ [key: number]: number }>(DEFAULT_CTR_VALUES);
  const [upliftCtr, setUpliftCtr] = useState<number>(0);
  const [minSearchVolume, setMinSearchVolume] = useState<number>(10);
  const [maxPosition, setMaxPosition] = useState<number>(50);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [inputValues, setInputValues] = useState({
    minSearchVolume: '10',
    maxPosition: '50',
    upliftCtr: '0'
  });

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsedKeywords: KeywordData[] = jsonData.map((row: any) => {
          // Handle SEMrush and other common column naming conventions
          const keyword = row.Keyword || row.keyword || row.KEYWORD || row.query || row.Query || row['Query'] || '';
          const position = parseInt(row.Position || row.position || row.POSITION || row.rank || row.Rank || row['Avg. Position'] || '0');
          const searchVolume = parseInt(
            row['Search Volume'] || 
            row['search volume'] || 
            row.Volume || 
            row.volume || 
            row['search_volume'] || 
            row['Monthly Search Volume'] ||
            row['Avg. Monthly Searches'] ||
            '0'
          );
          const currentTraffic = parseFloat(
            row.Traffic || 
            row.traffic || 
            row.TRAFFIC || 
            row['Current Traffic'] ||
            row['current traffic'] ||
            row['Est. Traffic'] ||
            row['Estimated Traffic'] ||
            row['Monthly Traffic'] ||
            '0'
          ) || undefined;

          return {
            keyword: String(keyword),
            position: isNaN(position) ? 0 : position,
            searchVolume: isNaN(searchVolume) ? 0 : searchVolume,
            currentTraffic
          };
        }).filter(k => k.keyword && k.position > 0 && k.searchVolume > 0);

        setKeywords(parsedKeywords);
      } catch (error) {
        console.error('File parsing error:', error);
        alert('Error parsing file. Please ensure it\'s a valid SEMrush export file (XLSX or CSV) with keyword data including columns for Keyword, Position, and Search Volume.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const calculateCTR = useCallback((position: number): number => {
    const baseCtr = ctrValues[position] || (position > 20 ? 0.1 : DEFAULT_CTR_VALUES[position] || 0.5);
    return baseCtr * (1 + upliftCtr / 100);
  }, [ctrValues, upliftCtr]);

  const processedKeywords = useMemo((): ProcessedKeyword[] => {
    return keywords
      .filter(k => k.searchVolume >= minSearchVolume && k.position <= maxPosition)
      .map(keyword => {
        const currentCtr = calculateCTR(keyword.position);
        const estimatedCurrentTraffic = keyword.currentTraffic || (keyword.searchVolume * currentCtr / 100);
        
        const trafficPosition3 = keyword.searchVolume * calculateCTR(3) / 100;
        const trafficPosition2 = keyword.searchVolume * calculateCTR(2) / 100;
        const trafficPosition1 = keyword.searchVolume * calculateCTR(1) / 100;

        return {
          ...keyword,
          estimatedCurrentTraffic,
          trafficPosition3,
          trafficPosition2,
          trafficPosition1,
          gainPosition3: trafficPosition3 - estimatedCurrentTraffic,
          gainPosition2: trafficPosition2 - estimatedCurrentTraffic,
          gainPosition1: trafficPosition1 - estimatedCurrentTraffic
        };
      });
  }, [keywords, minSearchVolume, maxPosition, calculateCTR]);

  const summary = useMemo(() => {
    const totalCurrentTraffic = processedKeywords.reduce((sum, k) => sum + k.estimatedCurrentTraffic, 0);
    const totalGainPosition3 = processedKeywords.reduce((sum, k) => sum + Math.max(0, k.gainPosition3), 0);
    const totalGainPosition1 = processedKeywords.reduce((sum, k) => sum + Math.max(0, k.gainPosition1), 0);

    // Chart data for traffic potential
    const chartData = [
      {
        name: 'Current',
        traffic: Math.round(totalCurrentTraffic),
        fill: '#3B82F6'
      },
      {
        name: 'Position 3',
        traffic: Math.round(totalCurrentTraffic + totalGainPosition3),
        fill: '#10B981'
      },
      {
        name: 'Position 1',
        traffic: Math.round(totalCurrentTraffic + totalGainPosition1),
        fill: '#8B5CF6'
      }
    ];

    // Position distribution data
    const positionDistribution = processedKeywords.reduce((acc, keyword) => {
      const posRange = keyword.position <= 3 ? '1-3' :
                     keyword.position <= 10 ? '4-10' :
                     keyword.position <= 20 ? '11-20' :
                     keyword.position <= 50 ? '21-50' : '50+';
      acc[posRange] = (acc[posRange] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const positionChartData = Object.entries(positionDistribution).map(([range, count]) => ({
      name: `Position ${range}`,
      value: count,
      fill: range === '1-3' ? '#10B981' :
            range === '4-10' ? '#F59E0B' :
            range === '11-20' ? '#EF4444' : '#6B7280'
    }));

    // Top opportunities (highest potential gain)
    const topOpportunities = processedKeywords
      .filter(k => k.gainPosition1 > 0)
      .sort((a, b) => b.gainPosition1 - a.gainPosition1)
      .slice(0, 10)
      .map(k => ({
        keyword: k.keyword.length > 25 ? k.keyword.substring(0, 25) + '...' : k.keyword,
        current: Math.round(k.estimatedCurrentTraffic),
        potential: Math.round(k.trafficPosition1),
        gain: Math.round(k.gainPosition1)
      }));

    return { 
      totalCurrentTraffic, 
      totalGainPosition3, 
      totalGainPosition1,
      chartData,
      positionChartData,
      topOpportunities
    };
  }, [processedKeywords]);

  const handleReset = () => {
    setCtrValues(DEFAULT_CTR_VALUES);
    setUpliftCtr(0);
    setMinSearchVolume(10);
    setMaxPosition(50);
    setInputValues({
      minSearchVolume: '10',
      maxPosition: '50',
      upliftCtr: '0'
    });
  };

  const exportToExcel = () => {
    if (processedKeywords.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = processedKeywords.map(k => ({
      'Keyword': k.keyword,
      'Current Position': k.position,
      'Search Volume': k.searchVolume,
      'Current Traffic': Math.round(k.estimatedCurrentTraffic * 100) / 100,
      'Traffic at Position 3': Math.round(k.trafficPosition3 * 100) / 100,
      'Traffic at Position 2': Math.round(k.trafficPosition2 * 100) / 100,
      'Traffic at Position 1': Math.round(k.trafficPosition1 * 100) / 100,
      'Gain to Position 3': Math.round(k.gainPosition3 * 100) / 100,
      'Gain to Position 2': Math.round(k.gainPosition2 * 100) / 100,
      'Gain to Position 1': Math.round(k.gainPosition1 * 100) / 100
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Keyword Analysis');
    XLSX.writeFile(wb, 'keyword-analysis.xlsx');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SEMrush Keyword Analyzer</h1>
          <p className="text-gray-600">Upload your keyword data and analyze traffic potential</p>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <Upload className="mr-2" size={24} />
            File Upload
          </h2>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-lg text-gray-600 mb-2">
              Drag and drop your SEMrush keyword export file here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported formats: XLSX, CSV (SEMrush Organic Research exports)
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Choose File
            </label>
          </div>
          {keywords.length > 0 && (
            <p className="mt-4 text-green-600 font-medium">
              ✓ Successfully loaded {keywords.length} keywords from SEMrush export
            </p>
          )}
        </div>

        {keywords.length > 0 && (
          <>
            {/* Filters and Parameters */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                  <Search className="mr-2" size={24} />
                  Filters & Parameters
                </h2>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="mr-2" size={16} />
                  Reset to Defaults
                </button>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Search Volume
                  </label>
                  <input
                    type="number"
                    value={inputValues.minSearchVolume}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInputValues(prev => ({ ...prev, minSearchVolume: value }));
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setMinSearchVolume(numValue);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || isNaN(parseInt(value))) {
                        setInputValues(prev => ({ ...prev, minSearchVolume: '10' }));
                        setMinSearchVolume(10);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Position
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={inputValues.maxPosition}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInputValues(prev => ({ ...prev, maxPosition: value }));
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 1) {
                        setMaxPosition(numValue);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || isNaN(parseInt(value)) || parseInt(value) < 1) {
                        setInputValues(prev => ({ ...prev, maxPosition: '50' }));
                        setMaxPosition(50);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uplift CTR (%)
                  </label>
                  <input
                    type="number"
                    value={inputValues.upliftCtr}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInputValues(prev => ({ ...prev, upliftCtr: value }));
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setUpliftCtr(numValue);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || isNaN(parseFloat(value))) {
                        setInputValues(prev => ({ ...prev, upliftCtr: '0' }));
                        setUpliftCtr(0);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* CTR Editor */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <Target className="mr-2" size={24} />
                CTR by Position (%)
              </h2>
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(position => (
                  <div key={position} className="text-center">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Pos {position}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={ctrValues[position] || 0}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value) || 0;
                        setCtrValues(prev => ({ ...prev, [position]: newValue }));
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {((ctrValues[position] || 0) * (1 + upliftCtr / 100)).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary and Results */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="mr-2" size={24} />
                  Analysis Results
                </h2>
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <Download className="mr-2" size={16} />
                  Export to Excel
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Current Traffic</h3>
                  <p className="text-3xl font-bold text-blue-700">
                    {Math.round(summary.totalCurrentTraffic).toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">Monthly visits</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Gain to Position 3</h3>
                  <p className="text-3xl font-bold text-green-700">
                    +{Math.round(summary.totalGainPosition3).toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600 mt-1">Additional monthly visits</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">Gain to Position 1</h3>
                  <p className="text-3xl font-bold text-purple-700">
                    +{Math.round(summary.totalGainPosition1).toLocaleString()}
                  </p>
                  <p className="text-sm text-purple-600 mt-1">Additional monthly visits</p>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <div className="text-sm text-gray-600 mb-4">
                  Showing {processedKeywords.length} keywords (filtered from {keywords.length} total)
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Keyword
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Search Volume
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Traffic
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Traffic at Pos 3
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Traffic at Pos 2
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Traffic at Pos 1
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gain to Pos 1
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedKeywords.map((keyword, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {keyword.keyword}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {keyword.position}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {keyword.searchVolume.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.round(keyword.estimatedCurrentTraffic)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.trafficPosition3)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.trafficPosition2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.trafficPosition1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${keyword.gainPosition1 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {keyword.gainPosition1 > 0 ? '+' : ''}{Math.round(keyword.gainPosition1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;