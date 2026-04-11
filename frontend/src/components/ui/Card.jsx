import clsx from 'clsx';

export const Card = ({ children, className, ...props }) => (
  <div className={clsx('glass-panel p-6', className)} {...props}>
    {children}
  </div>
);
