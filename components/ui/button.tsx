'use client'
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-[#1e3a5f] text-white hover:bg-[#152c4a] focus:ring-[#1e3a5f]': variant === 'default',
            'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-300': variant === 'outline',
            'text-gray-700 hover:bg-gray-100 focus:ring-gray-300': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600': variant === 'destructive',
            'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300': variant === 'secondary',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
