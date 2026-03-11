"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function TipTapEditor({
  content,
  onChange,
  placeholder = "Yazınızı buraya girin...",
  className,
}: TipTapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] p-4 focus:outline-none [&_p]:mb-2 [&_ul]:list-disc [&_ol]:list-decimal [&_h1]:text-xl [&_h2]:text-lg [&_strong]:font-bold",
      },
    },
  });

  const handleUpdate = useCallback(() => {
    if (editor) onChange(editor.getHTML());
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, handleUpdate]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div
      className={
        className ??
        "rounded-md border bg-background text-foreground"
      }
    >
      <EditorContent editor={editor} />
    </div>
  );
}
