"use client";

import { useState, useCallback, useEffect } from "react";
import {
  sendMessage,
  getMessage,
  markRead,
  getInbox,
  getSent,
  unreadCount,
  totalMessages,
  getAdmin,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function SentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Textarea for message content ─────────────────────────────

function TextArea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <textarea
          {...props}
          rows={3}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none resize-none"
        />
      </div>
    </div>
  );
}

// ── Message Type ─────────────────────────────────────────────

interface MessageData {
  id: bigint;
  sender: string;
  recipient: string;
  content: string;
  timestamp: bigint;
  read: boolean;
}

// ── Main Component ────────────────────────────────────────────

type Tab = "inbox" | "sent" | "compose";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("compose");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Compose state
  const [recipient, setRecipient] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Inbox/Sent state
  const [messageIds, setMessageIds] = useState<bigint[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageData | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Stats
  const [unread, setUnread] = useState<number>(0);
  const [totalMsgs, setTotalMsgs] = useState<bigint>(BigInt(0));

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTimestamp = (ts: bigint) => {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString();
  };

  // Load stats when wallet connects
  const loadStats = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [unreadCountVal, totalVal] = await Promise.all([
        unreadCount(walletAddress),
        totalMessages(),
      ]);
      setUnread(Number(unreadCountVal) || 0);
      setTotalMsgs(BigInt(totalVal || 0));
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Load messages for inbox or sent
  const loadMessages = useCallback(async (type: "inbox" | "sent") => {
    if (!walletAddress) return;
    setIsLoadingMessages(true);
    setSelectedMessage(null);
    try {
      const ids = type === "inbox" 
        ? await getInbox(walletAddress)
        : await getSent(walletAddress);
      setMessageIds(ids ? Array.from(ids as bigint[]) : []);
    } catch (e) {
      setError("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [walletAddress]);

  // Handle tab change
  useEffect(() => {
    if (activeTab === "inbox" || activeTab === "sent") {
      loadMessages(activeTab);
    }
  }, [activeTab, loadMessages]);

  // View a message
  const handleViewMessage = useCallback(async (msgId: bigint) => {
    if (!walletAddress) return;
    try {
      const msg = await getMessage(msgId, walletAddress) as MessageData;
      setSelectedMessage(msg);
      // If viewing inbox and message is unread, mark as read
      if (activeTab === "inbox" && msg && !msg.read) {
        await markRead(walletAddress, msgId);
        msg.read = true;
        loadStats();
      }
    } catch (e) {
      setError("Failed to load message");
    }
  }, [walletAddress, activeTab, loadStats]);

  // Send a message
  const handleSendMessage = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!recipient.trim()) return setError("Enter recipient address");
    if (!messageContent.trim()) return setError("Enter message content");
    if (messageContent.length > 500) return setError("Message exceeds 500 characters");
    
    setError(null);
    setIsSending(true);
    setTxStatus("Awaiting signature...");
    try {
      await sendMessage(walletAddress, recipient.trim(), messageContent.trim());
      setTxStatus("Message sent on-chain!");
      setRecipient("");
      setMessageContent("");
      setTimeout(() => setTxStatus(null), 5000);
      loadStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsSending(false);
    }
  }, [walletAddress, recipient, messageContent, loadStats]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string; badge?: number }[] = [
    { key: "compose", label: "Compose", icon: <SendIcon />, color: "#7c6cf0" },
    { key: "inbox", label: "Inbox", icon: <InboxIcon />, color: "#4fc3f7", badge: unread > 0 ? unread : undefined },
    { key: "sent", label: "Sent", icon: <SentIcon />, color: "#34d399" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") || txStatus.includes("sent") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#4fc3f7]/20 border border-white/[0.06]">
                <span className="text-[#7c6cf0]"><MessageIcon /></span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Decentralized Messaging</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <Badge variant="info" className="text-[10px]">Soroban</Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); setSelectedMessage(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {t.badge && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f87171] text-[9px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Compose */}
            {activeTab === "compose" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
                  <span style={{ color: "#7c6cf0" }} className="font-semibold">fn</span>
                  <span className="text-white/70"> send_message</span>
                  <span className="text-white/20 text-xs">(sender: Address, recipient: Address, content: String)</span>
                </div>
                <Input 
                  label="Recipient Address" 
                  value={recipient} 
                  onChange={(e) => setRecipient(e.target.value)} 
                  placeholder="G... (Stellar address)" 
                />
                <TextArea 
                  label="Message (max 500 chars)" 
                  value={messageContent} 
                  onChange={(e) => setMessageContent(e.target.value)} 
                  placeholder="Type your message..." 
                />
                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>{messageContent.length}/500 characters</span>
                </div>
                {walletAddress ? (
                  <ShimmerButton onClick={handleSendMessage} disabled={isSending} shimmerColor="#7c6cf0" className="w-full">
                    {isSending ? <><SpinnerIcon /> Sending...</> : <><SendIcon /> Send Message</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.03] py-4 text-sm text-[#7c6cf0]/60 hover:border-[#7c6cf0]/30 hover:text-[#7c6cf0]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to send messages
                  </button>
                )}
              </div>
            )}

            {/* Inbox / Sent */}
            {(activeTab === "inbox" || activeTab === "sent") && (
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>{activeTab === "inbox" ? "Received messages" : "Sent messages"}</span>
                  <span>{messageIds.length} message(s)</span>
                </div>

                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <SpinnerIcon />
                    <span className="ml-2 text-white/40">Loading messages...</span>
                  </div>
                ) : messageIds.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
                    <p className="text-white/40 text-sm">No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {messageIds.slice().reverse().map((msgId) => (
                      <button
                        key={String(msgId)}
                        onClick={() => handleViewMessage(msgId)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]",
                          selectedMessage?.id === msgId
                            ? "border-[#7c6cf0]/30 bg-[#7c6cf0]/[0.05]"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-white/70">#{String(msgId)}</span>
                          <span className="text-[10px] text-white/25">ID</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Message Detail */}
                {selectedMessage && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-fade-in-up">
                    <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Message Details</span>
                      {selectedMessage.read ? (
                        <Badge variant="success" className="text-[9px]">Read</Badge>
                      ) : (
                        <Badge variant="warning" className="text-[9px]">Unread</Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">From</span>
                        <span className="font-mono text-xs text-white/80">{truncate(selectedMessage.sender)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">To</span>
                        <span className="font-mono text-xs text-white/80">{truncate(selectedMessage.recipient)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Time</span>
                        <span className="font-mono text-xs text-white/80">{formatTimestamp(selectedMessage.timestamp)}</span>
                      </div>
                      <div className="pt-2 border-t border-white/[0.04]">
                        <span className="text-xs text-white/35 block mb-1">Content</span>
                        <p className="text-sm text-white/80 whitespace-pre-wrap">{selectedMessage.content}</p>
                      </div>
                      {activeTab === "inbox" && !selectedMessage.read && (
                        <button
                          onClick={() => handleViewMessage(selectedMessage.id)}
                          className="mt-2 flex items-center gap-2 text-xs text-[#4fc3f7] hover:text-[#4fc3f7]/80"
                        >
                          <EyeIcon /> Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Decentralized Messaging &middot; Soroban</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#7c6cf0]" />
                <span className="font-mono text-[9px] text-white/15">{String(totalMsgs)} msgs</span>
              </span>
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
