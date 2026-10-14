"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { signOut, slackStartUrl } from "./api";
import { SlackOAuthNotice } from "./oauth-notice";
import { SignInWithSlack } from "./sign-in-with-slack";
import { useMe } from "./use-me";

const ITEM = "flex w-full items-center gap-2 rounded-[3px] px-2.5 py-2 text-left text-[13px] text-stone-800 hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none";
const ONE_LINE = "overflow-hidden text-ellipsis whitespace-nowrap";

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    // Slack CDN avatar (72px), validated as https on the server.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={24} height={24} className="size-6 rounded-[4px] object-cover" />;
  }
  return (
    <span className="grid size-6 place-items-center rounded-[4px] bg-violet-700 text-[11px] font-semibold text-white" aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Top-bar account control: "Sign in with Slack" when signed out; avatar + name with a menu when signed in. */
export function UserMenu({ className }: { className?: string }) {
  const { me, isLoading } = useMe();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (isLoading) return <span className={cn("inline-block h-9 w-32 animate-pulse rounded-[4px] bg-stone-200", className)} aria-hidden />;
  if (!me?.user) {
    return (
      <>
        <SlackOAuthNotice />
        <SignInWithSlack isConfigured={me?.slackOAuth.configured ?? false} className={className} />
      </>
    );
  }
  const { user, slack } = me;

  async function handleSignOut() {
    setIsOpen(false);
    try {
      await signOut();
      toast.success("Signed out");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign out");
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <SlackOAuthNotice />
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-[4px] border border-stone-300 bg-white px-2 text-[13px] text-stone-900 hover:border-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50"
      >
        <Avatar name={user.name} src={user.avatar} />
        <span className={cn(ONE_LINE, "font-medium")}>{user.name}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-stone-500 transition-transform", isOpen && "rotate-180")} aria-hidden />
      </button>
      {isOpen && (
        <div role="menu" className="absolute right-0 z-50 mt-1.5 w-64 rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
          <div className="px-2.5 pb-2 pt-1.5">
            <div className={cn(ONE_LINE, "text-[13px] font-semibold text-stone-900")}>{user.name}</div>
            <div className={cn(ONE_LINE, "text-[12px] text-stone-500")}>{user.team}</div>
            <div className="mt-1.5 text-[12.5px] text-stone-700">
              {slack ? (
                <>
                  Posting to <span className="font-mono">#{slack.channel}</span> <span className="text-stone-500">· {slack.team}</span>
                </>
              ) : (
                <span className="text-amber-700">No channel connected</span>
              )}
            </div>
          </div>
          <div className="border-t border-stone-200 pt-1">
            {me.slackOAuth.configured && (
              <a role="menuitem" className={ITEM} href={slackStartUrl({})} onClick={(e) => (e.currentTarget.href = slackStartUrl({}))}>
                <RefreshCw className="size-3.5 text-stone-500" aria-hidden /> Change channel
              </a>
            )}
            <button role="menuitem" type="button" className={ITEM} onClick={handleSignOut}>
              <LogOut className="size-3.5 text-stone-500" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
