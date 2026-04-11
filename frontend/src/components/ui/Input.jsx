import React from 'react';
import clsx from 'clsx';

export const Input = React.forwardRef(({ className, label, error, ...props }, ref) => {
  return (
    <div className="flex flex-col w-full">
      {label && <label className="text-sm font-medium text-gray-300 mb-1.5">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          "bg-[#0f142b] border border-[rgba(255,255,255,0.1)] text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 transition-colors",
          error ? "border-red-500 focus:ring-red-500" : "focus:border-[#00d4ff] focus:ring-[rgba(0,212,255,0.3)]",
          className
        )}
        {...props}
      />
      {error && <span className="text-sm text-red-400 mt-1">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
