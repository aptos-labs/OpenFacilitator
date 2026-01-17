'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'typescript',
  showCopy = true,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative", className)}>
      <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-3 pr-12 overflow-x-auto text-[13px] font-mono leading-relaxed border border-zinc-800">
        <code>{code.trim()}</code>
      </pre>
      {showCopy && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
