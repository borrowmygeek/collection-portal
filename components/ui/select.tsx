import React, { useState, useRef, useEffect } from 'react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState('');

  // Find the display text for the current value
  useEffect(() => {
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === SelectItem) {
        if (child.props.value === value) {
          setDisplayValue(child.props.children);
        }
      }
    });
  }, [value, children]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className="relative">
      <SelectTrigger onClick={() => setIsOpen(!isOpen)}>
        <SelectValue value={value} displayValue={displayValue} />
      </SelectTrigger>
      {isOpen && (
        <SelectContent>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === SelectItem) {
              return React.cloneElement(child as React.ReactElement<SelectItemProps>, {
                onClick: () => {
                  onValueChange(child.props.value);
                  setIsOpen(false);
                }
              });
            }
            return child;
          })}
        </SelectContent>
      )}
    </div>
  );
}

interface SelectTriggerProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SelectTrigger({ children, onClick, className = '' }: SelectTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
      <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

interface SelectValueProps {
  value: string;
  displayValue?: string;
  placeholder?: string;
}

export function SelectValue({ value, displayValue, placeholder = 'Select an option' }: SelectValueProps) {
  return <span>{displayValue || placeholder}</span>;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectContent({ children, className = '' }: SelectContentProps) {
  return (
    <div className={`absolute top-full left-0 right-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SelectItem({ value, children, onClick, className = '' }: SelectItemProps) {
  return (
    <div
      onClick={onClick}
      className={`relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 ${className}`}
    >
      {children}
    </div>
  );
} 