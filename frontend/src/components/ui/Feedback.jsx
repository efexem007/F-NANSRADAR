import { AlertCircle } from 'lucide-react';

export const ErrorAlert = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start gap-3 my-4">
      <AlertCircle className="shrink-0 mt-0.5" size={20} />
      <div className="text-sm">{message}</div>
    </div>
  );
};

export const LoadingSpinner = ({ text = "Yükleniyor..." }) => (
  <div className="h-full w-full flex flex-col items-center justify-center p-8">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00d4ff] border-t-transparent mb-4"></div>
    <p className="text-gray-400 font-medium animate-pulse">{text}</p>
  </div>
);
