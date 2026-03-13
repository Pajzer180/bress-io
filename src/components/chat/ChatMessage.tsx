'use client';

import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import SeoCard from './SeoCard';
import type { SeoCardData } from '@/app/api/chat/route';

interface MessagePart {
  type: string;
  [key: string]: unknown;
}

interface Props {
  message: {
    id: string;
    role: 'user' | 'assistant';
    parts: MessagePart[];
  };
  userInitial: string;
}

function extractText(parts: MessagePart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } & MessagePart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

const SEO_MARKER = /__SEO_DATA__:([\s\S]+?)__END_SEO__\n?/;
const SEO_STRIP = /__SEO_DATA__:[\s\S]+?__END_SEO__\n?/g;

function parseMessageContent(text: string): { seoData: SeoCardData | null; cleanBody: string } {
  const match = text.match(SEO_MARKER);
  const cleanBody = text.replace(SEO_STRIP, '').trim();
  if (!match) return { seoData: null, cleanBody };
  try {
    return { seoData: JSON.parse(match[1]) as SeoCardData, cleanBody };
  } catch {
    return { seoData: null, cleanBody };
  }
}

const markdownComponents: Components = {
  code({ children, ...props }) {
    const isBlock = !props.node?.position || String(children).includes('\n');
    if (isBlock) {
      return <CodeBlock>{String(children).replace(/\n$/, '')}</CodeBlock>;
    }
    return (
      <code className="rounded bg-gray-800 px-1 py-0.5 text-xs text-gray-200" {...props}>
        {children}
      </code>
    );
  },
  a({ children, ...props }) {
    return (
      <a
        {...props}
        className="text-gray-400 no-underline transition-colors duration-150 hover:text-gray-200 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
};

export default function ChatMessage({ message, userInitial }: Props) {
  const text = extractText(message.parts);
  if (!text) return null;

  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          isUser
            ? 'bg-purple-600/20 text-purple-400'
            : 'border border-white/10 bg-white/5 text-gray-300'
        }`}
      >
        {isUser ? userInitial : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      {isUser ? (
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-purple-600 px-4 py-2.5 text-sm leading-relaxed text-white">
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      ) : (() => {
        const { seoData, cleanBody } = parseMessageContent(text);
        return (
          <div className="max-w-[75%] min-w-0">
            {seoData && <SeoCard {...seoData} />}
            {cleanBody && (
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-gray-200">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {cleanBody}
                </ReactMarkdown>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
