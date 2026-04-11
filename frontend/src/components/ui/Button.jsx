import clsx from 'clsx';

export const Button = ({ children, variant = 'primary', className, disabled, loading, ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e27] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#00d4ff] hover:bg-[#00e5ff] text-[#0a0e27] px-4 py-2 focus:ring-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.4)]',
    secondary: 'bg-[#1a2141] hover:bg-[#20284f] text-white px-4 py-2 border border-[rgba(255,255,255,0.1)] focus:ring-[#1a2141]',
    danger: 'bg-[#ff4757] hover:bg-[#ff5e6d] text-white px-4 py-2 focus:ring-[#ff4757]',
    outline: 'bg-transparent hover:bg-[rgba(0,212,255,0.1)] text-[#00d4ff] border border-[#00d4ff] px-4 py-2 focus:ring-[#00d4ff]',
  };

  return (
    <button 
      className={clsx(baseStyles, variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};
