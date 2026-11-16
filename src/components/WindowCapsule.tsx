import { Check, Copy, Eye, KeyRound, MailOpen, RotateCcw, Send, Share2 } from 'lucide-react';
import { useState } from 'react';
import { MOOD_THEMES } from '../scene/moodThemes';
import type { DayMood, WindowStage } from '../types/capsule';
import { isDevPreviewOrigin } from '../utils/capsuleCodec';

interface WindowCapsuleProps {
  stage: WindowStage;
  isReceiverMode: boolean;
  mood: DayMood;
  message: string;
  shareUrl: string;
  isPhoneView: boolean;
  onOpenWindow: () => void;
  onReopenToEdit: () => void;
  onPreviewAsFriend: () => void;
  onStartFresh: () => void;
  onOpenByCode: (codeOrUrl: string) => boolean;
}

export function WindowCapsule({
  stage,
  isReceiverMode,
  mood,
  message,
  shareUrl,
  isPhoneView,
  onOpenWindow,
  onReopenToEdit,
  onPreviewAsFriend,
  onStartFresh,
  onOpenByCode,
}: WindowCapsuleProps) {
  const [copied, setCopied] = useState(false);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);

  const isClosed =
    stage === 'closed_intro' || stage === 'closing' || stage === 'closed_sealed';
  const isInteractive = stage === 'closed_intro' || stage === 'closed_sealed';
  const theme = MOOD_THEMES[mood];
  const fromDevPreview = isDevPreviewOrigin();
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const el = document.getElementById('meadowpost-share-input') as HTMLInputElement | null;
      if (el) {
        el.select();
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: 'Meadowpost — A Sheep Message for You',
        text: 'Open the window to see the little sheep spell a message for you.',
        url: shareUrl,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onOpenByCode(codeInput);
    if (!ok) {
      setCodeError(true);
    } else {
      setCodeError(false);
      setShowCodeBox(false);
      setCodeInput('');
    }
  };

  if (stage === 'open') return null;

  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6 transition-colors duration-700 ${
        isClosed ? 'opacity-100' : 'opacity-100 pointer-events-none'
      } ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        backgroundColor:
          stage === 'opening'
            ? 'rgba(245, 240, 232, 0.0)'
            : 'rgba(244, 238, 229, 0.34)',
      }}
    >
      <div
        className={`casement-stage relative w-full ${
          isPhoneView ? 'max-w-[344px]' : 'max-w-[440px]'
        } ${stage === 'opening' ? 'casement-opening' : 'casement-closed'}`}
      >
        <div className="casement-frame-zoom animate-gentle-float">
          {/* Outer Soft White Plaster Trim */}
          <div
            className="relative rounded-[26px] p-3 sm:p-4 border border-[#dcd6cc] shadow-[0_26px_64px_rgba(48,38,26,0.24)]"
            style={{
              background: 'linear-gradient(145deg, #fbfaf7 0%, #ebe6de 100%)',
            }}
          >
            {/* Warm Honey-Oak Wooden Window Frame & Deep Sill */}
            <div
              className="relative rounded-[16px] p-2.5 sm:p-3 border border-[#b9844e] shadow-[inset_0_3px_10px_rgba(94,61,28,0.28)]"
              style={{
                background:
                  'linear-gradient(160deg, #e1b583 0%, #cf9b63 55%, #bf8850 100%)',
              }}
            >
              {/* Window Opening Viewport */}
              <div
                className={`relative rounded-[8px] overflow-hidden border border-[#a57342]/60 ${
                  isPhoneView ? 'min-h-[380px]' : 'min-h-[410px] sm:min-h-[430px]'
                } flex items-center justify-center`}
                style={{
                  boxShadow: 'inset 0 8px 18px rgba(52, 34, 16, 0.25)',
                }}
              >
                {/* Bottom Wooden Sill Ledge */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 inset-x-0 h-5 border-t border-[#e5be91]/70"
                  style={{
                    background:
                      'linear-gradient(180deg, #deb17f 0%, #c68e56 100%)',
                  }}
                />

                {/* Cute Terracotta Potted Succulent on Left Windowsill */}
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-1.5 left-3.5 z-10 w-12 h-14 drop-shadow-[0_3px_4px_rgba(40,26,14,0.26)]"
                  viewBox="0 0 64 76"
                  fill="none"
                >
                  <ellipse cx="32" cy="24" rx="8" ry="12" fill="#7da77b" />
                  <ellipse
                    cx="22"
                    cy="27"
                    rx="7"
                    ry="11"
                    transform="rotate(-28 22 27)"
                    fill="#6c966a"
                  />
                  <ellipse
                    cx="42"
                    cy="27"
                    rx="7"
                    ry="11"
                    transform="rotate(28 42 27)"
                    fill="#6c966a"
                  />
                  <ellipse
                    cx="17"
                    cy="34"
                    rx="6.5"
                    ry="10"
                    transform="rotate(-52 17 34)"
                    fill="#5d865b"
                  />
                  <ellipse
                    cx="47"
                    cy="34"
                    rx="6.5"
                    ry="10"
                    transform="rotate(52 47 34)"
                    fill="#5d865b"
                  />
                  <circle cx="32" cy="29" r="5.5" fill="#9bc297" />
                  <rect x="13" y="38" width="38" height="8" rx="2.5" fill="#d9865b" />
                  <rect x="13" y="44" width="38" height="2" fill="#b86840" />
                  <path d="M16 46H48L44 70H20L16 46Z" fill="#c9744b" />
                  <path d="M16 46H26L24 70H20L16 46Z" fill="#d9855c" opacity="0.55" />
                </svg>

                {/* Double White Mullioned Glass Casement Sashes */}
                <div className="casement-stage absolute inset-0 flex pointer-events-none">
                  <div className="casement-sash-left relative w-1/2 h-full p-1.5 pr-0.5">
                    <div className="relative w-full h-full rounded-[4px] border-[7px] border-[#f8f6f2] shadow-[inset_0_0_0_1px_rgba(140,126,110,0.28),0_4px_12px_rgba(36,28,18,0.16)] flex flex-col">
                      <div
                        className="flex-1 relative overflow-hidden border border-[#d6cfc5]/60"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(226,240,250,0.14) 55%, rgba(255,255,255,0.22) 100%)',
                        }}
                      >
                        <div className="absolute -top-6 -left-6 w-20 h-44 rotate-[24deg] bg-white/20" />
                      </div>
                      <div className="h-[6px] bg-[#f8f6f2] border-y border-[#dfd8ce]" />
                      <div
                        className="flex-1 relative overflow-hidden border border-[#d6cfc5]/60"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(226,240,250,0.12) 60%, rgba(255,255,255,0.18) 100%)',
                        }}
                      />
                      <div
                        className="casement-latch absolute top-1/2 -right-[6px] -translate-y-1/2 w-2.5 h-7 rounded-full border border-[#8e6722]"
                        style={{
                          background:
                            'linear-gradient(180deg, #ecd084 0%, #c89b3c 65%, #9f7523 100%)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="casement-sash-right relative w-1/2 h-full p-1.5 pl-0.5">
                    <div className="relative w-full h-full rounded-[4px] border-[7px] border-[#f8f6f2] shadow-[inset_0_0_0_1px_rgba(140,126,110,0.28),0_4px_12px_rgba(36,28,18,0.16)] flex flex-col">
                      <div
                        className="flex-1 relative overflow-hidden border border-[#d6cfc5]/60"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(226,240,250,0.14) 55%, rgba(255,255,255,0.22) 100%)',
                        }}
                      >
                        <div className="absolute -top-6 -left-6 w-20 h-44 rotate-[24deg] bg-white/20" />
                      </div>
                      <div className="h-[6px] bg-[#f8f6f2] border-y border-[#dfd8ce]" />
                      <div
                        className="flex-1 relative overflow-hidden border border-[#d6cfc5]/60"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(226,240,250,0.12) 60%, rgba(255,255,255,0.18) 100%)',
                        }}
                      />
                      <div
                        className="casement-latch absolute top-1/2 -left-[6px] -translate-y-1/2 w-2.5 h-7 rounded-full border border-[#8e6722]"
                        style={{
                          background:
                            'linear-gradient(180deg, #ecd084 0%, #c89b3c 65%, #9f7523 100%)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Centered Cozy Parchment Letter Card */}
                <div
                  className={`relative z-20 w-full flex items-center justify-center p-4 transition-opacity duration-300 ${
                    stage === 'opening' ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <div
                    className="w-full max-w-[336px] rounded-2xl p-4 sm:p-5 border border-[#d9cab6] shadow-[0_14px_34px_rgba(40,30,18,0.16)] text-center flex flex-col items-center"
                    style={{ backgroundColor: 'rgba(255, 250, 243, 0.95)' }}
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 shadow-[0_4px_12px_rgba(180,104,92,0.28)] border-2 border-[#f4d8d0]"
                      style={{
                        background:
                          'radial-gradient(circle at 32% 28%, #e9a396 0%, #d47c6e 72%, #bf6659 100%)',
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        className="w-6 h-6 text-[#fffaf4]"
                        viewBox="0 0 40 40"
                        fill="currentColor"
                      >
                        <circle cx="14" cy="21" r="6.5" />
                        <circle cx="20" cy="17" r="7.5" />
                        <circle cx="26" cy="21" r="6.5" />
                        <circle cx="20" cy="24" r="6.5" />
                        <ellipse cx="20" cy="22" rx="4.2" ry="3.6" fill="#3b312d" />
                        <circle cx="18.5" cy="21.5" r="0.9" fill="#fffaf4" />
                        <circle cx="21.5" cy="21.5" r="0.9" fill="#fffaf4" />
                      </svg>
                    </div>

                    {stage === 'closed_sealed' ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-[#73675b] mb-1">
                          <span>Window Sealed</span>
                          <span aria-hidden="true">·</span>
                          <span>{theme.label} Sky</span>
                        </div>
                        <h2 className="font-display text-2xl font-medium text-[#2f2a24] text-balance mb-1.5">
                          Ready to Send
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5c5349] max-w-[260px] mb-3 line-clamp-2">
                          &ldquo;{message}&rdquo;
                        </p>

                        <div className="w-full flex items-center gap-1.5 p-1 rounded-xl bg-[#f3eadc] border border-[#d6c7b2] mb-2">
                          <input
                            id="meadowpost-share-input"
                            type="text"
                            readOnly
                            value={shareUrl}
                            aria-label="Shareable capsule link"
                            className="flex-1 min-w-0 bg-transparent px-2 py-1 text-xs text-[#433b33] focus:outline-none truncate"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-[#fffaf4] bg-[#4c6b47] hover:bg-[#3f5b3a] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[36px]"
                          >
                            {copied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                          {canNativeShare && (
                            <button
                              type="button"
                              onClick={handleNativeShare}
                              aria-label="Share capsule link"
                              className="inline-flex items-center justify-center p-2 rounded-lg text-xs font-semibold text-[#2f2a24] bg-[#e5d8c5] hover:bg-[#d8c9b2] transition-colors shrink-0 cursor-pointer min-h-[36px]"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {fromDevPreview && (
                          <p className="text-[11px] text-[#786b5e] leading-snug mb-2.5 max-w-[280px]">
                            To open this link on a phone, publish once via AI Studio&apos;s Share button so the public link is active.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={onPreviewAsFriend}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#2f2a24] bg-[#ebe0cf] hover:bg-[#e1d3be] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={onReopenToEdit}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#5c5349] hover:text-[#2f2a24] hover:bg-[#efe6d8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <MailOpen className="w-3.5 h-3.5" />
                            <span>Reopen</span>
                          </button>
                          <button
                            type="button"
                            onClick={onStartFresh}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#5c5349] hover:text-[#2f2a24] hover:bg-[#efe6d8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>New</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-xs text-[#73675b] mb-1">
                          <span>Meadowpost</span>
                          <span aria-hidden="true">·</span>
                          <span>{isReceiverMode ? `${theme.label} Letter` : 'Message Capsule'}</span>
                        </div>
                        <h1 className="font-display text-2xl sm:text-[28px] font-medium text-[#2f2a24] text-balance mb-2">
                          {isReceiverMode ? 'A Letter Awaits You' : 'Send a Sheep Note'}
                        </h1>
                        <p className="text-xs sm:text-sm text-[#5c5349] max-w-[260px] mb-4 leading-relaxed">
                          {isReceiverMode
                            ? 'Open the wooden window to watch the sheep gather with your message.'
                            : 'Open the window to record a note for the little sheep to form in the meadow.'}
                        </p>

                        <button
                          type="button"
                          onClick={onOpenWindow}
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#fffaf4] bg-[#4c6b47] hover:bg-[#3f5b3a] active:scale-[0.98] shadow-[0_8px_20px_rgba(76,107,71,0.28)] transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
                        >
                          {isReceiverMode ? (
                            <MailOpen className="w-4 h-4" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          <span>Open Window</span>
                        </button>

                        {!isReceiverMode && (
                          <div className="mt-3 w-full">
                            {showCodeBox ? (
                              <form onSubmit={handleCodeSubmit} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={codeInput}
                                  onChange={(e) => {
                                    setCodeInput(e.target.value);
                                    setCodeError(false);
                                  }}
                                  placeholder="Paste link or capsule code..."
                                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-[#f3eadc] border border-[#d6c7b2] text-[#2f2a24] focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#fffaf4] bg-[#4c6b47] hover:bg-[#3f5b3a] whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  Open
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowCodeBox(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#706458] hover:text-[#2f2a24] transition-colors cursor-pointer"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Have a capsule link or code?</span>
                              </button>
                            )}
                            {codeError && (
                              <p className="text-[11px] text-[#b55a4c] mt-1">
                                Could not read that capsule code.
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
