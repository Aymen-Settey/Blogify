"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { uploadFile } from "@/lib/api";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code as CodeIcon,
  ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
} from "lucide-react";

const lowlight = createLowlight(common);

interface BlogEditorProps {
  initialContent?: Record<string, unknown>;
  onChange?: (json: Record<string, unknown>) => void;
  placeholder?: string;
}

export function BlogEditor({ initialContent, onChange, placeholder }: BlogEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-4 max-w-full" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-brand-600 underline" } }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing your research...",
      }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: initialContent || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "prose-content min-h-[400px] outline-none",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <Toolbar editor={editor} />
      <div className="p-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const handleImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const res = await uploadFile<{ url: string }>("/api/uploads/image", file);
        editor.chain().focus().setImage({ src: res.url }).run();
      } catch (err) {
        alert("Image upload failed");
        console.error(err);
      }
    };
    input.click();
  };

  const handleLink = () => {
    const url = prompt("Enter URL:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 flex-wrap bg-slate-50">
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} label="Bold">
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} label="Italic">
          <Italic className="h-4 w-4" />
        </Btn>
      </BtnGroup>
      <Divider />
      <BtnGroup>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          label="H1"
        >
          <Heading1 className="h-4 w-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          label="H2"
        >
          <Heading2 className="h-4 w-4" />
        </Btn>
      </BtnGroup>
      <Divider />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} label="Bullet list">
          <List className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} label="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} label="Quote">
          <Quote className="h-4 w-4" />
        </Btn>
      </BtnGroup>
      <Divider />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} label="Code block">
          <CodeIcon className="h-4 w-4" />
        </Btn>
        <Btn onClick={handleImage} label="Insert image">
          <ImageIcon className="h-4 w-4" />
        </Btn>
        <Btn onClick={handleLink} active={editor.isActive("link")} label="Insert link">
          <LinkIcon className="h-4 w-4" />
        </Btn>
      </BtnGroup>
      <Divider />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().undo().run()} label="Undo">
          <Undo className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} label="Redo">
          <Redo className="h-4 w-4" />
        </Btn>
      </BtnGroup>
    </div>
  );
}

function Btn({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-brand-100 text-brand-700"
          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center">{children}</div>;
}

function Divider() {
  return <div className="h-6 w-px bg-slate-300 mx-1" />;
}
