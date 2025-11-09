import React from 'react';
import './ScanLines.css';

interface ScanLinesProps {
  enabled?: boolean;
}

const ScanLines: React.FC<ScanLinesProps> = ({ enabled = false }) => {
  if (!enabled) return null;

  return (
    <>
      <div className="scanlines"></div>
      <div className="crt-flicker"></div>
    </>
  );
};

export default ScanLines;
