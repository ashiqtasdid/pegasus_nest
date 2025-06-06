import React from 'react';

const BackgroundDecorations: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-1/2 -right-1/2 w-80 h-80 bg-slate-500/10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-1/2 -left-1/2 w-80 h-80 bg-slate-500/10 rounded-full blur-2xl"></div>
    </div>
  );
};

export default BackgroundDecorations;
