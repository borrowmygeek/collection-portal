import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps extends CardProps {
  onClick?: () => void;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white shadow-sm border border-gray-200 rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', onClick }: CardHeaderProps) {
  return (
    <div 
      className={`px-6 py-4 border-b border-gray-200 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: CardProps) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: CardProps) {
  return (
    <p className={`text-sm text-gray-600 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }: CardProps) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
} 