import React from 'react';
import { generateRandomAppName } from '../utils/nameGenerator';

interface RandomNameGeneratorProps {
  onGenerate: (name: string) => void;
}

const RandomNameGenerator: React.FC<RandomNameGeneratorProps> = ({ onGenerate }) => {
  const handleGenerateClick = () => {
    const randomName = generateRandomAppName();
    onGenerate(randomName);
  };

  return (
    <button 
      type="button"
      onClick={handleGenerateClick}
      className="ml-2 px-3 bg-blue-100 hover:bg-blue-200 rounded border border-blue-300 text-blue-700 h-10 flex items-center justify-center"
      title="Generate random name"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );
};

export default RandomNameGenerator;
