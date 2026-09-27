/**
 * A/R Tax Services, LLC - Role-Specific Demonstration AI Assistant Drawer
 * Deterministic, compliant simulated AI intelligence panel.
 */

import React, { useState, useEffect } from 'react';
import { DemoRole, DemoAiResponse } from '../types';
import { DemoAIService } from '../services/DemoAIService';
import { Sparkles, Send, ShieldAlert, CheckCircle2, FileText, HelpCircle } from 'lucide-react';

interface AiAssistantDrawerProps {
  role: DemoRole;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({ role }) => {
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DemoAiResponse | null>(null);
  const [samplePrompts, setSamplePrompts] = useState<string[]>([]);

  useEffect(() => {
    const prompts = DemoAIService.getSamplePromptsForRole(role);
    setSamplePrompts(prompts);
    // Load initial default query for the role
    if (prompts.length > 0) {
      handleQuery(prompts[0]);
    }
  }, [role]);

  const handleQuery = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await DemoAIService.queryRoleAssistant(role, query);
      setResponse(res);
      setPromptInput('');
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header Badge */}
      <div className="border border-neutral-300 p-3 bg-white space-y-1">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-black">
          <Sparkles className="w-3.5 h-3.5 text-black" />
          <span>Demonstration AI Assistant</span>
        </div>
        <p className="text-[11px] text-neutral-600">
          Synthetic tax and accounting assistant. Responses are simulated demonstration examples.
        </p>
      </div>

      {/* Suggested Prompts */}
      <div className="space-y-1.5">
        <div className="font-bold uppercase tracking-wider text-[10px] text-neutral-500">
          Suggested Scenario Inquiries:
        </div>
        <div className="space-y-1">
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleQuery(p)}
              disabled={loading}
              className="w-full text-left p-2 border border-neutral-200 hover:border-black hover:bg-neutral-50 text-[11px] font-medium text-black transition-colors rounded-none disabled:opacity-50"
            >
              &ldquo;{p}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Query Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleQuery(promptInput);
        }}
        className="space-y-1.5 pt-1"
      >
        <div className="font-bold uppercase tracking-wider text-[10px] text-neutral-500">
          Ask Custom Inquiry:
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Type tax or workflow query..."
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-2.5 py-1.5 text-xs border border-neutral-300 bg-white text-black focus:outline-none focus:border-black rounded-none"
          />
          <button
            type="submit"
            disabled={loading || !promptInput.trim()}
            className="px-3 py-1.5 bg-black text-white font-bold hover:bg-neutral-800 disabled:bg-neutral-300 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Response Panel */}
      {loading ? (
        <div className="p-4 border border-neutral-300 bg-neutral-50 text-center space-y-2">
          <div className="font-bold text-black animate-pulse">
            Analyzing Demonstration Workpapers...
          </div>
          <div className="text-[11px] text-neutral-500">
            Checking IRS regulations and source documents
          </div>
        </div>
      ) : response ? (
        <div className="border border-black bg-white p-3.5 space-y-3">
          {/* Status & Confidence */}
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <span className="font-bold uppercase text-[10px] tracking-wider text-black">
              {response.assistantTitle}
            </span>
            <span className="font-mono text-[10px] font-bold border border-black px-1.5 py-0.5">
              Confidence: {response.confidence}%
            </span>
          </div>

          {/* User Prompt Echo */}
          <div className="text-[11px] font-mono text-neutral-600 bg-neutral-50 p-2 border border-neutral-200">
            <strong>Query:</strong> &ldquo;{response.prompt}&rdquo;
          </div>

          {/* Executive Summary */}
          <div className="space-y-1">
            <div className="font-bold text-black text-xs">Summary:</div>
            <p className="text-xs text-neutral-800 leading-relaxed font-medium">
              {response.summary}
            </p>
          </div>

          {/* Breakdown Details */}
          <div className="space-y-1.5">
            <div className="font-bold text-black text-xs">Analysis Points:</div>
            <ul className="space-y-1">
              {response.details.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-700 leading-normal">
                  <span className="font-mono font-bold text-black">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Source Records */}
          <div className="space-y-1 border-t border-neutral-200 pt-2">
            <div className="font-bold text-[10px] uppercase tracking-wider text-neutral-600 flex items-center gap-1">
              <FileText className="w-3 h-3 text-black" />
              <span>Source Records Examined:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {response.sourceRecords.map((s, i) => (
                <span key={i} className="border border-neutral-300 px-1.5 py-0.5 text-[10px] bg-neutral-50 font-mono">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Assumptions */}
          <div className="space-y-1 border-t border-neutral-200 pt-2">
            <div className="font-bold text-[10px] uppercase tracking-wider text-neutral-600">
              Underlying Assumptions:
            </div>
            <ul className="text-[10px] text-neutral-600 space-y-0.5">
              {response.assumptions.map((a, i) => (
                <li key={i}>&bull; {a}</li>
              ))}
            </ul>
          </div>

          {/* Human Review Requirement Notice */}
          <div className="border border-black bg-neutral-50 p-2 text-[10px] font-bold text-black space-y-1">
            <div className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-black" />
              <span>CPA / EA Human Review Notice:</span>
            </div>
            <p className="font-normal text-neutral-700">
              {response.humanReviewRequirement}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
