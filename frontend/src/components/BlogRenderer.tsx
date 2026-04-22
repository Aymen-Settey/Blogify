"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

export function BlogRenderer({ content }: { content: Record<string, unknown> }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image,
      Link,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose-content outline-none" },
    },
  });

  return <EditorContent editor={editor} />;
}
