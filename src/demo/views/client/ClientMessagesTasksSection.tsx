import React, { useState } from 'react';
import {
  MessageSquare,
  CheckSquare,
  Send,
  Paperclip,
  Clock,
  ShieldCheck,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Filter,
  ArrowRight,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientMessagesTasksSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToVault?: () => void;
  onNavigateToOrganizer?: () => void;
  onNavigateToSignatures?: () => void;
}

export const ClientMessagesTasksSection: React.FC<ClientMessagesTasksSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToVault,
  onNavigateToOrganizer,
  onNavigateToSignatures
}) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'tasks'>('messages');
  const [selectedThreadId, setSelectedThreadId] = useState('th_01');
  const [newMessageText, setNewMessageText] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Message Threads
  const [threads, setThreads] = useState([
    {
      id: 'th_01',
      title: '2025 Form 1120-S Senior Review & K-1 Questions',
      category: 'Tax Preparation',
      assignedTo: 'Elena Rostova, CPA',
      lastActivity: '15 mins ago',
      unreadCount: 0,
      messages: [
        {
          id: 'm1',
          sender: 'Elena Rostova, CPA',
          senderRole: 'Senior CPA Reviewer',
          timestamp: 'Feb 19, 2026 at 10:14 AM',
          text: 'Good morning Michael, we have completed the draft Form 1120-S workpapers. Before final partner signature, please confirm that the $175,000 W-2 officer salary matches your final fourth-quarter Form 941 wage transcript. Also, remember to review the two business meal receipts in Charlotte.',
          isClient: false
        },
        {
          id: 'm2',
          sender: 'Michael Perotti',
          senderRole: 'Client Taxpayer',
          timestamp: 'Feb 19, 2026 at 10:30 AM',
          text: 'Thank you Elena. Yes, the $175k W-2 matches our ADP payroll reports exactly. I just submitted the attendee list for the Charlotte meetings in the bookkeeping workspace.',
          isClient: true
        },
        {
          id: 'm3',
          sender: 'Elena Rostova, CPA',
          senderRole: 'Senior CPA Reviewer',
          timestamp: 'Feb 19, 2026 at 11:05 AM',
          text: 'Excellent, thank you. The draft Form 1120-S and SC PTE schedule are staged in your Document Vault. We will generate the e-file Form 8879 authorization once partner Desmond Hinds completes the second-tier sign-off.',
          isClient: false
        }
      ]
    },
    {
      id: 'th_02',
      title: 'South Carolina PTE Election (Act 61) Tax Savings',
      category: 'Tax Planning',
      assignedTo: 'Desmond Hinds, CEO',
      lastActivity: 'Yesterday',
      unreadCount: 0,
      messages: [
        {
          id: 'm4',
          sender: 'Desmond Hinds, CEO',
          senderRole: 'Managing Partner',
          timestamp: 'Feb 18, 2026 at 02:40 PM',
          text: 'Michael, making the South Carolina PTE election on Form SC 1120-S will reduce your personal federal taxable income by allowing the state tax payment to bypass the individual $10,000 SALT cap. We estimate net tax savings of approximately $14,200 for 2025.',
          isClient: false
        }
      ]
    }
  ]);

  // Actionable Client Tasks
  const [tasks, setTasks] = useState([
    {
      id: 'tsk_01',
      title: 'Review and Confirm Charlotte Prospective Client Attendees',
      assignedBy: 'Elena Rostova, CPA',
      dueDate: 'Feb 22, 2026',
      status: 'In Progress' as 'In Progress' | 'Completed' | 'Pending',
      category: 'Bookkeeping Clarification',
      deepLinkTarget: 'bookkeeping'
    },
    {
      id: 'tsk_02',
      title: 'Sign 2025 Form 8879 E-File Authorization Form',
      assignedBy: 'A/R Tax Services Compliance',
      dueDate: 'March 01, 2026',
      status: 'Pending',
      category: 'Signatures & Consent',
      deepLinkTarget: 'signatures'
    },
    {
      id: 'tsk_03',
      title: 'Upload Final December Commercial Loan Statement (LN-004819)',
      assignedBy: 'Elena Rostova, CPA',
      dueDate: 'Feb 15, 2026',
      status: 'Completed',
      category: 'Document Vault',
      deepLinkTarget: 'vault'
    }
  ]);

  const activeThread = threads.find(t => t.id === selectedThreadId) || threads[0];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    const newMsg = {
      id: `m_${Date.now()}`,
      sender: 'Michael Perotti',
      senderRole: 'Client Taxpayer',
      timestamp: 'Just now',
      text: newMessageText,
      isClient: true
    };

    setThreads(prev =>
      prev.map(t =>
        t.id === activeThread.id
          ? { ...t, messages: [...t.messages, newMsg], lastActivity: 'Just now' }
          : t
      )
    );

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Sent Secure Portal Message',
      record: activeThread.title,
      result: 'Success (Simulated)',
      reason: 'Client sent message to CPA team'
    });

    setNewMessageText('');
    setActionNotice('Message transmitted securely to Elena Rostova, CPA.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleToggleTask = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Completed' ? 'In Progress' : 'Completed';
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, status: newStatus as any } : t))
    );
    setActionNotice(`Task marked as ${newStatus}.`);
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: `Updated Task Status to ${newStatus}`,
      record: id,
      result: 'Success (Simulated)',
      reason: 'Client task progression'
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6" id="client-messages-tasks-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Encrypted Communications
              </span>
              <span className="text-xs text-[#667085]">Direct CPA Inquiries &bull; 256-bit AES</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Secure Messages, Inquiries &amp; Actionable Tasks
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Collaborate directly with assigned engagement leaders Elena Rostova, CPA and Desmond Hinds, CEO.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Clock className="w-4 h-4 text-[#C99A32]" />
            <span>Target Response Time: <strong>&lt; 1 Business Day</strong></span>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Encrypted delivery</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#D8DCE2] pt-4">
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'messages'
                ? 'border-[#061A2F] text-[#061A2F]'
                : 'border-transparent text-[#667085] hover:text-[#061A2F]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Secure Conversations ({threads.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-[#061A2F] text-[#061A2F]'
                : 'border-transparent text-[#667085] hover:text-[#061A2F]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Actionable Tasks ({tasks.filter(t => t.status !== 'Completed').length} Pending)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MESSAGES */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Thread List */}
          <div className="bg-white rounded-lg border border-[#D8DCE2] p-4 space-y-2 shadow-xs">
            <div className="text-xs font-bold text-[#061A2F] uppercase text-[10px] font-mono border-b border-[#D8DCE2] pb-2">
              Active Inquiries &amp; Topics
            </div>
            <div className="space-y-1.5">
              {threads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full p-3 rounded text-left transition-colors cursor-pointer border ${
                    selectedThreadId === thread.id
                      ? 'bg-[#FAF9F5] border-[#061A2F]'
                      : 'bg-white border-[#E5E7EB] hover:border-[#061A2F]'
                  }`}
                >
                  <div className="text-[10px] font-mono text-[#667085] uppercase">{thread.category}</div>
                  <div className="font-bold text-xs text-[#061A2F] truncate mt-0.5">{thread.title}</div>
                  <div className="text-[11px] text-[#667085] mt-1 flex justify-between">
                    <span>{thread.assignedTo}</span>
                    <span className="font-mono text-[10px]">{thread.lastActivity}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Conversation Feed */}
          <div className="md:col-span-2 bg-white rounded-lg border border-[#D8DCE2] p-5 space-y-4 shadow-xs flex flex-col justify-between min-h-[450px]">
            <div>
              <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeThread.assignedTo.includes('Desmond') && (
                    <div className="w-10 h-10 rounded-full border border-[#D7AC4A] overflow-hidden flex-shrink-0 bg-[#061A2F]">
                      <img
                        src="/ceo/123456789-desmond.png"
                        alt="Desmond Hinds, Founder and Chief Executive Officer of A/R Tax Services, LLC"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-sm text-[#061A2F]">{activeThread.title}</h3>
                    <div className="text-xs text-[#667085]">
                      Lead: <strong className="text-[#061A2F]">{activeThread.assignedTo}</strong> &bull; Category: {activeThread.category}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                  256-Bit Encrypted
                </span>
              </div>

              {/* Messages Stream */}
              <div className="space-y-3 pt-4 overflow-y-auto max-h-80">
                {activeThread.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-lg border max-w-xl text-xs space-y-1 ${
                      msg.isClient
                        ? 'ml-auto bg-[#061A2F] text-[#F7F4ED] border-[#061A2F]'
                        : 'mr-auto bg-[#FBFAF7] text-[#061A2F] border-[#E5E7EB]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] font-mono opacity-75 border-b pb-1 border-white/20">
                      <span>{msg.sender} ({msg.senderRole})</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="pt-1 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="pt-3 border-t border-[#D8DCE2] flex items-center gap-2">
              <input
                type="text"
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
                placeholder="Type your message to Elena Rostova, CPA..."
                className="flex-1 p-2.5 border border-[#D8DCE2] rounded text-xs focus:outline-none focus:border-[#061A2F]"
                required
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#E8C66A]" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: TASKS */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Assigned Taxpayer Actions</h3>
            <p className="text-xs text-[#667085]">Outstanding deliverables required to advance workpapers to e-file stage.</p>
          </div>

          <div className="space-y-3">
            {tasks.map(task => {
              const isDone = task.status === 'Completed';
              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isDone ? 'bg-[#FAF9F5] border-[#D8DCE2] opacity-75' : 'bg-white border-[#D8DCE2]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleToggleTask(task.id, task.status)}
                      className="mt-1 rounded text-[#061A2F] cursor-pointer"
                    />
                    <div>
                      <div className={`text-sm font-bold ${isDone ? 'line-through text-[#667085]' : 'text-[#061A2F]'}`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-[#667085] mt-0.5 flex flex-wrap items-center gap-3">
                        <span>Assigned by: <strong>{task.assignedBy}</strong></span>
                        <span>&bull;</span>
                        <span>Due: <strong className="font-mono text-[#061A2F]">{task.dueDate}</strong></span>
                        <span>&bull;</span>
                        <span className="px-2 py-0.5 bg-[#FBFAF7] border border-[#D8DCE2] text-[10px] rounded font-mono">
                          {task.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {task.deepLinkTarget === 'vault' && onNavigateToVault && (
                      <button
                        onClick={onNavigateToVault}
                        className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] flex items-center gap-1"
                      >
                        <span>Open Vault</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {task.deepLinkTarget === 'signatures' && onNavigateToSignatures && (
                      <button
                        onClick={onNavigateToSignatures}
                        className="px-3 py-1.5 bg-[#061A2F] text-white rounded text-xs font-bold flex items-center gap-1"
                      >
                        <span>Go to Signatures</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
