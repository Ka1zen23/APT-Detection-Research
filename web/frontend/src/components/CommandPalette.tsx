import { useEffect } from "react";
import { Command } from "cmdk";
import { FlaskConical, ListChecks, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { flatNav } from "@/lib/nav";
import { useExperiments, useFindings } from "@/hooks/queries";
import { Badge } from "@/components/ui/badge";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: experiments } = useExperiments(undefined, open);
  const { data: findings } = useFindings(open);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Global research search"
      className="fixed left-1/2 top-[18%] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Command.Input
          placeholder="Search pages, experiments, findings…"
          className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground">
          ESC
        </kbd>
      </div>
      <Command.List className="max-h-[55vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
          No matching research item.
        </Command.Empty>
        <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted-foreground">
          {flatNav.map((item) => {
            const Icon = item.icon;
            return (
              <Command.Item
                key={item.to}
                value={`${item.label} ${item.description ?? ""}`}
                onSelect={() => go(item.to)}
                className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 text-xs text-foreground aria-selected:bg-elevated"
              >
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{item.label}</span>
                <span className="ml-auto truncate text-[12px] text-muted-foreground">
                  {item.description}
                </span>
              </Command.Item>
            );
          })}
        </Command.Group>
        <Command.Group heading="Experiments" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted-foreground">
          {(experiments ?? []).map((experiment) => (
            <Command.Item
              key={experiment.id}
              value={`${experiment.id} ${experiment.name}`}
              onSelect={() => go(`/experiments/${experiment.id}`)}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 text-xs text-foreground aria-selected:bg-elevated"
            >
              <FlaskConical className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[12px] text-muted-foreground">{experiment.id}</span>
              <span className="truncate">{experiment.name}</span>
              <Badge variant="outline" className="ml-auto shrink-0 text-[12px]">
                {experiment.status.replace("_", " ")}
              </Badge>
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Findings" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted-foreground">
          {(findings?.findings ?? []).map((finding) => (
            <Command.Item
              key={finding.id}
              value={`${finding.id} ${finding.title} ${finding.observation}`}
              onSelect={() => go("/findings")}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 text-xs text-foreground aria-selected:bg-elevated"
            >
              <ListChecks className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[12px] text-muted-foreground">{finding.id}</span>
              <span className="truncate">{finding.title}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
        Search covers curated pages, the experiment registry and preliminary findings. Individual
        provenance event search is not included in this aggregate snapshot.
      </div>
    </Command.Dialog>
  );
}
