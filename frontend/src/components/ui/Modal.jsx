import { X } from 'lucide-react';
import { useEffect } from 'react';
import clsx from 'clsx';

export const Modal = ({ isOpen, onClose, title, children, className }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Modal Paneli */}
      <div 
        className={clsx(
          "relative glass-panel bg-[#0d122b] w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border-[rgba(255,255,255,0.1)]",
          className
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
