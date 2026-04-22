"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Comment } from "@/lib/types";
import { CornerDownRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface CommentThreadProps {
  postId: string;
  onCountChange?: (n: number) => void;
}

export function CommentThread({ postId, onCountChange }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await apiFetch<Comment[]>(`/api/posts/${postId}/comments`);
        if (cancelled) return;
        setComments(data);
        onCountChange?.(countAll(data));
      } catch {
        if (!cancelled) setError("Couldn't load comments. Refresh to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleNew = (comment: Comment, parentId: string | null) => {
    setComments((prev) => {
      const next = parentId
        ? insertReply(prev, parentId, comment)
        : [...prev, comment];
      onCountChange?.(countAll(next));
      return next;
    });
  };

  if (loading) return <CommentsSkeleton />;

  return (
    <div>
      <CommentForm postId={postId} parentId={null} onCreated={(c) => handleNew(c, null)} />

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-6 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="mt-8 space-y-6">
        {comments.length === 0 ? (
          <p className="text-sm text-ink-5 italic">Be the first to comment.</p>
        ) : (
          comments.map((c) => (
            <CommentItem key={c.id} postId={postId} comment={c} onReply={handleNew} />
          ))
        )}
      </div>
    </div>
  );
}

function CommentItem({
  postId,
  comment,
  onReply,
  depth = 0,
}: {
  postId: string;
  comment: Comment;
  onReply: (c: Comment, parentId: string | null) => void;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);
  const created = new Date(comment.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={depth > 0 ? "ml-6 pl-4 border-l-2 border-ink-2" : ""}>
      <div className="flex items-start gap-3">
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-ink-2"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {(comment.author?.username || "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            {comment.author && (
              <Link
                href={`/profile/${comment.author.username}`}
                className="font-semibold text-ink-9 hover:text-brand-700 transition-colors"
              >
                {comment.author.display_name || comment.author.username}
              </Link>
            )}
            <span className="text-xs text-ink-4">·</span>
            <span className="text-xs text-ink-5">{created}</span>
          </div>
          <p className="mt-1 text-sm text-ink-7 whitespace-pre-wrap leading-relaxed">
            {comment.content}
          </p>
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-5 hover:text-brand-700 transition-colors"
          >
            <CornerDownRight className="h-3 w-3" />
            Reply
          </button>
          {replying && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onCreated={(c) => {
                  onReply(c, comment.id);
                  setReplying(false);
                }}
                compact
              />
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              postId={postId}
              comment={r}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  onCreated,
  compact,
}: {
  postId: string;
  parentId: string | null;
  onCreated: (c: Comment) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="rounded-lg border border-ink-2 bg-paper-1 px-4 py-3 text-sm text-ink-6">
        <Link
          href="/auth/login"
          className="font-medium text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>{" "}
        to join the conversation.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const comment = await apiFetch<Comment>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: trimmed, parent_comment_id: parentId }),
      });
      onCreated(comment);
      setContent("");
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Failed to post comment";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div
        className={cn(
          "relative rounded-xl overflow-hidden",
          submitting && "comment-shimmer",
        )}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={parentId ? "Write a reply…" : "Share your thoughts…"}
          rows={compact ? 2 : 3}
          disabled={submitting}
          className="block w-full rounded-xl border border-ink-2 bg-paper-0 px-3 py-2 text-sm text-ink-9 placeholder:text-ink-4 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/40 resize-none transition-colors disabled:opacity-70"
        />
      </div>
      {error && (
        <p role="alert" aria-live="assertive" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink-9 px-4 py-1.5 text-sm font-medium text-paper-0 hover:bg-ink-8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitting ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
      </div>
    </form>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-24 rounded-xl comment-shimmer bg-paper-1 border border-ink-2" />
      {[0, 1].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full comment-shimmer bg-paper-2 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded comment-shimmer bg-paper-2" />
            <div className="h-3 w-full rounded comment-shimmer bg-paper-2" />
            <div className="h-3 w-2/3 rounded comment-shimmer bg-paper-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function countAll(comments: Comment[]): number {
  return comments.reduce((sum, c) => sum + 1 + countAll(c.replies || []), 0);
}

function insertReply(tree: Comment[], parentId: string, reply: Comment): Comment[] {
  return tree.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...(c.replies || []), reply] };
    }
    return { ...c, replies: insertReply(c.replies || [], parentId, reply) };
  });
}
