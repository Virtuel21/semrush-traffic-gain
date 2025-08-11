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
  trafficB13: number;
  trafficB46: number;
  trafficB710: number;
  trafficB1120: number;
  gainB13: number;
  gainB46: number;
  gainB710: number;
  gainB1120: number;
  expectedTraffic: number;
  gainExpected: number;
}

type Bucket = 'B13' | 'B46' | 'B710' | 'B1120' | 'B21P';

// Default CTR values per bucket (positions: 1-3,4-6,7-10,11-20,21+)
const DEFAULT_BUCKET_CTR: Record<Bucket, number> = {
  B13: (28.5 + 15.7 + 11.0) / 3, // average of positions 1-3
  B46: (8.0 + 6.1 + 4.8) / 3,
  B710: (3.8 + 3.0 + 2.5 + 2.1) / 4,
  B1120:
    (1.8 + 1.5 + 1.3 + 1.1 + 1.0 + 0.9 + 0.8 + 0.7 + 0.6 + 0.5) /
    10,
  B21P: 0.1
};

const BUCKET_LABELS: Record<Bucket, string> = {
  B13: 'Pos 1-3',
  B46: 'Pos 4-6',
  B710: 'Pos 7-10',
  B1120: 'Pos 11-20',
  B21P: 'Pos 21+'
};

function App() {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [bucketCtr, setBucketCtr] = useState<Record<Bucket, number>>(DEFAULT_BUCKET_CTR);
  const [probMatrix, setProbMatrix] = useState({
    p13: 5,
    p46: 15,
    p710: 30,
    pstay: 20
  });
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

        const parsedKeywords: KeywordData[] = (jsonData as Record<string, unknown>[]) .map(row => {
          // Handle SEMrush and other common column naming conventions
          const keyword = (row.Keyword || row.keyword || row.KEYWORD || row.query || row.Query || row['Query'] || '') as string;
          const position = parseInt(
            (row.Position || row.position || row.POSITION || row.rank || row.Rank || row['Avg. Position'] || '0') as string
          );
          const searchVolume = parseInt(
            (row['Search Volume'] ||
              row['search volume'] ||
              row.Volume ||
              row.volume ||
              row['search_volume'] ||
              row['Monthly Search Volume'] ||
              row['Avg. Monthly Searches'] ||
              '0') as string
          );
          const currentTraffic =
            parseFloat(
              (row.Traffic ||
                row.traffic ||
                row.TRAFFIC ||
                row['Current Traffic'] ||
                row['current traffic'] ||
                row['Est. Traffic'] ||
                row['Estimated Traffic'] ||
                row['Monthly Traffic'] ||
                '0') as string
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

  const positionToBucket = useCallback((position: number): Bucket => {
    if (position <= 3) return 'B13';
    if (position <= 6) return 'B46';
    if (position <= 10) return 'B710';
    if (position <= 20) return 'B1120';
    return 'B21P';
  }, []);

  const calculateBucketCTR = useCallback(
    (bucket: Bucket): number => bucketCtr[bucket] * (1 + upliftCtr / 100),
    [bucketCtr, upliftCtr]
  );

  const processedKeywords = useMemo((): ProcessedKeyword[] => {
    const p1120 = Math.max(
      0,
      100 - probMatrix.p13 - probMatrix.p46 - probMatrix.p710 - probMatrix.pstay
    );

    return keywords
      .filter(k => k.searchVolume >= minSearchVolume && k.position <= maxPosition)
      .map(keyword => {
        const currentBucket = positionToBucket(keyword.position);
        const currentCtr = calculateBucketCTR(currentBucket);
        const estimatedCurrentTraffic =
          keyword.currentTraffic || keyword.searchVolume * currentCtr / 100;

        const trafficB13 = keyword.searchVolume * calculateBucketCTR('B13') / 100;
        const trafficB46 = keyword.searchVolume * calculateBucketCTR('B46') / 100;
        const trafficB710 = keyword.searchVolume * calculateBucketCTR('B710') / 100;
        const trafficB1120 = keyword.searchVolume * calculateBucketCTR('B1120') / 100;

        const expectedCtr =
          (probMatrix.p13 / 100) * calculateBucketCTR('B13') +
          (probMatrix.p46 / 100) * calculateBucketCTR('B46') +
          (probMatrix.p710 / 100) * calculateBucketCTR('B710') +
          (p1120 / 100) * calculateBucketCTR('B1120') +
          (probMatrix.pstay / 100) * currentCtr;
        const expectedTraffic = keyword.searchVolume * expectedCtr / 100;

        return {
          ...keyword,
          estimatedCurrentTraffic,
          trafficB13,
          trafficB46,
          trafficB710,
          trafficB1120,
          gainB13: trafficB13 - estimatedCurrentTraffic,
          gainB46: trafficB46 - estimatedCurrentTraffic,
          gainB710: trafficB710 - estimatedCurrentTraffic,
          gainB1120: trafficB1120 - estimatedCurrentTraffic,
          expectedTraffic,
          gainExpected: expectedTraffic - estimatedCurrentTraffic
        };
      });
  }, [
    keywords,
    minSearchVolume,
    maxPosition,
    positionToBucket,
    calculateBucketCTR,
    probMatrix
  ]);

  const summary = useMemo(() => {
    const totalCurrentTraffic = processedKeywords.reduce(
      (sum, k) => sum + k.estimatedCurrentTraffic,
      0
    );
    const totalExpectedTraffic = processedKeywords.reduce(
      (sum, k) => sum + k.expectedTraffic,
      0
    );
    const totalGain = totalExpectedTraffic - totalCurrentTraffic;

    // Chart data for traffic potential
    const chartData = [
      {
        name: 'Current',
        traffic: Math.round(totalCurrentTraffic),
        fill: '#3B82F6'
      },
      {
        name: 'Expected',
        traffic: Math.round(totalExpectedTraffic),
        fill: '#10B981'
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

    const positionChartData = Object.entries(positionDistribution).map(
      ([range, count]) => ({
        name: `Position ${range}`,
        value: count,
        fill:
          range === '1-3'
            ? '#10B981'
            : range === '4-10'
            ? '#F59E0B'
            : range === '11-20'
            ? '#EF4444'
            : '#6B7280'
      })
    );

    // Top opportunities (highest potential gain)
    const topOpportunities = processedKeywords
      .filter(k => k.gainExpected > 0)
      .sort((a, b) => b.gainExpected - a.gainExpected)
      .slice(0, 10)
      .map(k => ({
        keyword:
          k.keyword.length > 25 ? k.keyword.substring(0, 25) + '...' : k.keyword,
        current: Math.round(k.estimatedCurrentTraffic),
        potential: Math.round(k.expectedTraffic),
        gain: Math.round(k.gainExpected)
      }));

    return {
      totalCurrentTraffic,
      totalExpectedTraffic,
      totalGain,
      chartData,
      positionChartData,
      topOpportunities
    };
  }, [processedKeywords]);

  const handleReset = () => {
    setBucketCtr(DEFAULT_BUCKET_CTR);
    setProbMatrix({ p13: 5, p46: 15, p710: 30, pstay: 20 });
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
      Keyword: k.keyword,
      'Current Position': k.position,
      'Search Volume': k.searchVolume,
      'Current Traffic': Math.round(k.estimatedCurrentTraffic * 100) / 100,
      'Traffic B13': Math.round(k.trafficB13 * 100) / 100,
      'Traffic B46': Math.round(k.trafficB46 * 100) / 100,
      'Traffic B710': Math.round(k.trafficB710 * 100) / 100,
      'Traffic B1120': Math.round(k.trafficB1120 * 100) / 100,
      'Gain B13': Math.round(k.gainB13 * 100) / 100,
      'Gain B46': Math.round(k.gainB46 * 100) / 100,
      'Gain B710': Math.round(k.gainB710 * 100) / 100,
      'Gain B1120': Math.round(k.gainB1120 * 100) / 100,
      'Expected Traffic': Math.round(k.expectedTraffic * 100) / 100,
      'Expected Gain': Math.round(k.gainExpected * 100) / 100
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
                CTR by Bucket (%)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(['B13', 'B46', 'B710', 'B1120', 'B21P'] as Bucket[]).map(bucket => (
                  <div key={bucket} className="text-center">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {BUCKET_LABELS[bucket]}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={bucketCtr[bucket]}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value) || 0;
                        setBucketCtr(prev => ({ ...prev, [bucket]: newValue }));
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {calculateBucketCTR(bucket).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Probability Matrix */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Probability Matrix (%)</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(['p13', 'p46', 'p710', 'pstay'] as const).map(key => (
                  <div key={key} className="text-center">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {key.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={probMatrix[key]}
                      onChange={e => {
                        const newValue = parseFloat(e.target.value) || 0;
                        setProbMatrix(prev => ({ ...prev, [key]: newValue }));
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}
                <div className="text-center">
                  <label className="block text-xs font-medium text-gray-600 mb-1">p1120</label>
                  <div className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50">
                    {(
                      Math.max(
                        0,
                        100 -
                          probMatrix.p13 -
                          probMatrix.p46 -
                          probMatrix.p710 -
                          probMatrix.pstay
                      ) || 0
                    ).toFixed(1)}
                  </div>
                </div>
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
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Expected Traffic</h3>
                  <p className="text-3xl font-bold text-green-700">
                    {Math.round(summary.totalExpectedTraffic).toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600 mt-1">Monthly visits</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">Total Gain</h3>
                  <p className="text-3xl font-bold text-purple-700">
                    {Math.round(summary.totalGain).toLocaleString()}
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
                        Traffic B13
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gain B13
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Traffic B46
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gain B46
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Traffic B710
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gain B710
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Traffic B1120
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gain B1120
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expected Traffic
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expected Gain
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
                          {Math.round(keyword.trafficB13)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${keyword.gainB13 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {keyword.gainB13 > 0 ? '+' : ''}{Math.round(keyword.gainB13)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.trafficB46)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${keyword.gainB46 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {keyword.gainB46 > 0 ? '+' : ''}{Math.round(keyword.gainB46)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.trafficB710)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${keyword.gainB710 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {keyword.gainB710 > 0 ? '+' : ''}{Math.round(keyword.gainB710)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.trafficB1120)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${keyword.gainB1120 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {keyword.gainB1120 > 0 ? '+' : ''}{Math.round(keyword.gainB1120)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {Math.round(keyword.expectedTraffic)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${keyword.gainExpected > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {keyword.gainExpected > 0 ? '+' : ''}{Math.round(keyword.gainExpected)}
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
