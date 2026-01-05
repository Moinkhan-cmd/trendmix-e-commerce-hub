import { useEffect, useRef } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export default function RichTextEditor({ value, onChange, placeholder, disabled, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = document.activeElement === el;
    if (!active && el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML);
  };

  const exec = (cmd: string, arg?: string) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };

  const addLink = () => {
    const href = window.prompt("Enter link URL");
    if (!href) return;
    exec("createLink", href);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => exec("bold")} disabled={disabled}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("italic")} disabled={disabled}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("underline")} disabled={disabled}>
          <Underline className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("insertUnorderedList")} disabled={disabled}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("insertOrderedList")} disabled={disabled}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={disabled}>
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder || "Write something..."}
        className={cn(
          "min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "[&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-muted-foreground"
        )}
      />
    </div>
  );
}
